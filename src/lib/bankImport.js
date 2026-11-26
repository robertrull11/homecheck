// Importación de extractos bancarios.
// El archivo se lee en el propio dispositivo con pdf.js y NUNCA se sube a ningún sitio.
// De cada movimiento solo se conservan fecha, concepto (limpio) e importe: ni IBAN, ni cuenta, ni titulares.

const PDFJS_DIR = './vendor/pdfjs/';
let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const base = new URL(PDFJS_DIR, document.baseURI).href;
      const lib = await import(/* @vite-ignore */ `${base}pdf.min.mjs`);
      lib.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.mjs`;
      return lib;
    })().catch((e) => { pdfjsPromise = null; throw e; });
  }
  return pdfjsPromise;
}

// Devuelve, por página, los trozos de texto con su posición.
export async function pdfToPages(file) {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = lib.getDocument({ data, isEvalSupported: false, disableFontFace: true });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str.trim() })));
    }
    return pages;
  } finally {
    try { await task.destroy(); } catch { /* ya cerrado */ }
  }
}

// Agrupa los trozos de una página en filas (misma altura), de arriba abajo y de izquierda a derecha.
export function rowsOf(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= 2.5) last.cells.push(it);
    else rows.push({ y: it.y, cells: [it] });
  }
  return rows.map((r) => r.cells.sort((a, b) => a.x - b.x));
}

const DATE_DM = /^(\d{2})\.(\d{2})$/;
const DATE_FULL = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const AMOUNT = /^(\d{1,3}(?:\.\d{3})*,\d{2})\s*(-)?$/;
const toNumber = (s) => { const m = s.match(AMOUNT); if (!m) return null; const n = Number(m[1].replace(/\./g, '').replace(',', '.')); return m[2] ? -n : n; };
const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

// ── Deutsche Bank (España): "EXTRACTO DE CUENTA CORRIENTE DB" en PDF ──
export function parseDeutscheBank(pages) {
  const rows = pages.flatMap(rowsOf);
  const text = rows.map((r) => r.map((c) => c.s).join(' ')).join('\n');
  if (!/DEUTSCHE BANK|DEUTESBB/i.test(text) || !/EXTRACTO/i.test(text)) return null;

  let statement = null;
  for (const r of rows) {
    for (const c of r) { const m = c.s.match(DATE_FULL); if (m) { statement = { d: +m[1], m: +m[2], y: +m[3] }; break; } }
    if (statement) break;
  }

  let opening = null;
  const lines = [];
  let lastWasMovement = false;
  for (const r of rows) {
    const first = r[0];
    const dm = first.s.match(DATE_DM);
    if (dm && first.x < 60) {
      const rest = r.slice(1);
      const amounts = rest.filter((c) => AMOUNT.test(c.s)).map((c) => toNumber(c.s));
      const concept = rest.filter((c) => !AMOUNT.test(c.s) && !DATE_DM.test(c.s)).map((c) => c.s).join(' ').replace(/\s+/g, ' ').trim();
      lastWasMovement = false;
      if (/^SALDO ANTERIOR/i.test(concept)) { if (amounts.length) opening = amounts[amounts.length - 1]; continue; }
      if (/^(SUMA Y SIGUE|SUMA I SEGUEIX|SALDO)/i.test(concept) || !amounts.length || !concept) continue;
      lines.push({ day: +dm[1], month: +dm[2], concept, amount: amounts[0], balance: amounts.length > 1 ? amounts[1] : null });
      lastWasMovement = true;
    } else if (lastWasMovement && r.every((c) => c.x >= 60 && c.x < 320 && !AMOUNT.test(c.s))) {
      // El concepto sigue en la línea de abajo
      lines[lines.length - 1].concept += ` ${r.map((c) => c.s).join(' ')}`;
    } else {
      lastWasMovement = false;
    }
  }

  // Comprobación con el saldo que da el banco después de cada movimiento
  let mismatches = 0;
  let running = opening;
  for (const l of lines) {
    if (running != null && l.balance != null && Math.abs(round2(running + l.amount) - l.balance) > 0.005) mismatches++;
    running = l.balance != null ? l.balance : running != null ? round2(running + l.amount) : null;
  }
  const checked = opening != null && lines.every((l) => l.balance != null);

  return {
    bank: 'Deutsche Bank',
    statement,
    year: statement?.y ?? new Date().getFullYear(),
    lines,
    opening,
    closing: lines.length ? lines[lines.length - 1].balance : opening,
    balanceChecked: checked,
    mismatches,
  };
}

// ── Deutsche Bank: "EXTRACTE INTEGRAT DB" / "EXTRACTO INTEGRADO DB" (catalán o castellano) ──
const DATE_DMY = /^(\d{2})\.(\d{2})\.(\d{2})$/;
const SIGNED = /^(-?)(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const toSigned = (s) => { const m = s.match(SIGNED); if (!m) return null; const n = Number(m[2].replace(/\./g, '').replace(',', '.')); return m[1] ? -n : n; };

export function parseDeutscheBankIntegrated(pages) {
  const rows = pages.flatMap(rowsOf);
  const text = rows.map((r) => r.map((c) => c.s).join(' ')).join('\n');
  if (!/DEUTSCHE BANK|DEUTESBB/i.test(text) || !/EXTRACTE INTEGRAT|EXTRACTO INTEGRADO/i.test(text)) return null;

  // Saldo anterior y actual de la cuenta (fila del IBAN en el detalle de posiciones)
  let opening = null;
  let closingTable = null;
  for (const r of rows) {
    if (r.some((c) => /^IBAN$/i.test(c.s))) {
      const nums = r.map((c) => toSigned(c.s)).filter((n) => n != null);
      if (nums.length >= 2) { opening = nums[0]; closingTable = nums[1]; break; }
    }
  }

  const lines = [];
  let lastWasMovement = false;
  for (const r of rows) {
    const first = r[0];
    const d = first.s.match(DATE_DMY);
    if (d && first.x < 110) {
      const rest = r.slice(1);
      const nums = rest.filter((c) => SIGNED.test(c.s));
      const concept = rest.filter((c) => !SIGNED.test(c.s) && !DATE_DMY.test(c.s)).map((c) => c.s).join(' ').replace(/\s+/g, ' ').trim();
      lastWasMovement = false;
      if (!nums.length || !concept || /^SALDO|^SUMA/i.test(concept)) continue;
      lines.push({ day: +d[1], month: +d[2], y: 2000 + +d[3], concept, amount: toSigned(nums[0].s), balance: nums.length > 1 ? toSigned(nums[nums.length - 1].s) : null });
      lastWasMovement = true;
    } else if (lastWasMovement && r.every((c) => c.x >= 120 && c.x < 310 && !SIGNED.test(c.s) && !DATE_DMY.test(c.s))) {
      lines[lines.length - 1].concept += ` ${r.map((c) => c.s).join(' ')}`;
    } else {
      lastWasMovement = false;
    }
  }

  let mismatches = 0;
  let running = opening;
  for (const l of lines) {
    if (running != null && l.balance != null && Math.abs(round2(running + l.amount) - l.balance) > 0.005) mismatches++;
    running = l.balance != null ? l.balance : running != null ? round2(running + l.amount) : null;
  }
  const closing = lines.length ? lines[lines.length - 1].balance : opening;
  if (closingTable != null && closing != null && Math.abs(closingTable - closing) > 0.005) mismatches++;
  const last = lines[lines.length - 1];

  return {
    bank: 'Deutsche Bank',
    statement: last ? { d: last.day, m: last.month, y: last.y } : null,
    year: last ? last.y : new Date().getFullYear(),
    fixedYear: true,
    lines,
    opening,
    closing,
    balanceChecked: opening != null && lines.every((l) => l.balance != null),
    mismatches,
  };
}

// ── BBVA: "Últimos movimientos" descargado de la web o la app (PDF) ──
// Cada movimiento ocupa dos filas: «fecha · concepto · importe · saldo» y debajo «Fecha valor … · detalle».
// Vienen del más reciente al más antiguo y cada fecha trae el año.
const DATE_SLASH = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const EURO = /^(-?)(\d{1,3}(?:\.?\d{3})*,\d{2})\s*€$/;
const toEuro = (s) => { const m = s.match(EURO); if (!m) return null; const n = Number(m[2].replace(/\./g, '').replace(',', '.')); return m[1] ? -n : n; };
// Detalles que no aportan nada al concepto
const BBVA_NOISE = /^(Pago con tarjeta|Otros|Transferencia recibida|Ingreso por n[oó]mina o pensi[oó]n|Bbva oficina\b.*)$/i;

export function parseBBVA(pages) {
  const rows = pages.flatMap(rowsOf);
  const text = rows.map((r) => r.map((c) => c.s).join(' ')).join('\n');
  if (!/BANCO BILBAO VIZCAYA|BBVA/i.test(text) || !/[ÚU]ltimos movimientos/i.test(text)) return null;

  const newestFirst = [];
  for (const r of rows) {
    const d = r[0].s.match(DATE_SLASH);
    if (d && r[0].x < 120) {
      const rest = r.slice(1);
      const nums = rest.filter((c) => EURO.test(c.s));
      const concept = rest.filter((c) => !EURO.test(c.s)).map((c) => c.s).join(' ').replace(/\s+/g, ' ').trim();
      if (nums.length < 1 || !concept) continue;
      newestFirst.push({ day: +d[1], month: +d[2], y: +d[3], concept, amount: toEuro(nums[0].s), balance: nums.length > 1 ? toEuro(nums[nums.length - 1].s) : null });
      continue;
    }
    const v = r[0].s.match(/^Fecha valor\s+\d{2}\/\d{2}\/\d{4}$/i);
    const last = newestFirst[newestFirst.length - 1];
    if (v && last && !last.detailDone) {
      const detail = r.slice(1).map((c) => c.s).join(' ').replace(/\s+/g, ' ').trim();
      if (detail && !BBVA_NOISE.test(detail)) last.concept += ` · ${detail}`;
      last.detailDone = true;
    }
  }
  const lines = newestFirst.reverse().map(({ detailDone, ...l }) => l);
  const first = lines[0];
  const opening = first && first.balance != null ? round2(first.balance - first.amount) : null;

  let mismatches = 0;
  let running = opening;
  for (const l of lines) {
    if (running != null && l.balance != null && Math.abs(round2(running + l.amount) - l.balance) > 0.005) mismatches++;
    running = l.balance != null ? l.balance : running != null ? round2(running + l.amount) : null;
  }
  const last = lines[lines.length - 1];
  return {
    bank: 'BBVA',
    statement: last ? { d: last.day, m: last.month, y: last.y } : null,
    year: last ? last.y : new Date().getFullYear(),
    fixedYear: true,
    lines,
    opening,
    closing: last ? last.balance : opening,
    balanceChecked: opening != null && lines.every((l) => l.balance != null),
    mismatches,
  };
}

const PARSERS = [parseDeutscheBank, parseDeutscheBankIntegrated, parseBBVA];

export async function readStatement(file) {
  const pages = await pdfToPages(file);
  for (const parse of PARSERS) {
    const res = parse(pages);
    if (res) return res;
  }
  return null;
}

// Varios extractos a la vez (p. ej. todo el año): se leen uno a uno y se juntan en una sola lista.
export async function readStatements(files) {
  const parsed = [];
  const unknown = [];
  let failed = 0;
  for (const f of files) {
    let res = null;
    try { res = await readStatement(f); } catch (e) { console.error(e); failed++; }
    if (!res) { unknown.push(f.name); continue; }
    // Cada movimiento lleva su año (en el extracto mensual se deduce de la fecha del extracto)
    const sm = res.statement?.m ?? 12;
    const sy = res.year;
    res.lines = res.lines.map((l) => (l.y != null ? l : { ...l, y: l.month > sm ? sy - 1 : sy }));
    parsed.push(res);
  }
  if (!parsed.length) {
    if (failed === files.length) throw new Error('No se ha podido leer ningún archivo');
    return { merged: null, unknown };
  }
  const key = (p) => (p.statement ? p.statement.y * 10000 + p.statement.m * 100 + p.statement.d : 0);
  parsed.sort((a, b) => key(a) - key(b));
  // El mismo extracto elegido dos veces se cuenta una sola vez
  const seen = new Set();
  const list = parsed.filter((p) => { const k = `${key(p)}|${p.opening}|${p.closing}|${p.lines.length}`; if (seen.has(k)) return false; seen.add(k); return true; });
  let gaps = 0;
  for (let i = 1; i < list.length; i++) if (list[i].opening != null && list[i - 1].closing != null && Math.abs(list[i].opening - list[i - 1].closing) > 0.005) gaps++;
  const first = list[0];
  const last = list[list.length - 1];
  return {
    unknown,
    merged: {
      bank: last.bank,
      files: list.length,
      first: first.statement,
      statement: last.statement,
      year: last.year,
      lines: list.flatMap((p) => p.lines),
      opening: first.opening,
      closing: last.closing,
      balanceChecked: list.every((p) => p.balanceChecked),
      mismatches: list.reduce((a, p) => a + p.mismatches, 0) + gaps,
    },
  };
}

// Fechas reales: el año del extracto (si un movimiento es de un mes posterior al del extracto, es del año anterior)
export function datedLines(parsed, year) {
  const stmtMonth = parsed.statement?.m ?? 12;
  return parsed.lines.map((l) => {
    // Si el extracto trae el año en cada fecha, se respeta (moviéndolo si el usuario cambia el año)
    const y = l.y != null ? l.y + (year - parsed.year) : l.month > stmtMonth ? year - 1 : year;
    return { ...l, year: y, date: `${y}-${pad(l.month)}-${pad(l.day)}` };
  });
}

// ── Conceptos ──
const SMALL = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'a', 'al', 'y', 'i', 'en', 'per', 'por', 'sr', 'sra']);

// Concepto para guardar: oculta números largos (referencias, préstamos, cuentas) y lo deja legible.
export function cleanConcept(raw) {
  let s = ` ${raw} `
    .replace(/[A-Z]{2}\d{2}(?:\s?\d{4}){3,}(?:\s?\d{1,4})?/g, '…')       // IBAN
    .replace(/\d[\d\s-]{4,}\d/g, (m) => (m.replace(/\D/g, '').length >= 6 ? '…' : m)) // referencias largas
    .replace(/\s+/g, ' ').trim()
    .replace(/^(RECIBO|REBUT)\s+/i, '');
  s = s.split(' ').map((w, i) => {
    if (!/[A-ZÀ-Ý]/.test(w) || /[a-zà-ÿ]/.test(w)) return w;               // ya tiene minúsculas o no es palabra
    if (/^([A-Z]\.){1,}[A-Z]?\.?$/.test(w) || w.length <= 2 && !SMALL.has(w.toLowerCase())) return w; // siglas (S.A., C.P.)
    const lower = w.toLowerCase();
    if (i > 0 && SMALL.has(lower.replace(/\.$/, ''))) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
  return s || raw;
}

// Clave para recordar cómo se clasificó un concepto (sin números, acentos ni signos).
export function conceptKey(raw) {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[0-9]+/g, ' ').replace(/[^A-Z]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
