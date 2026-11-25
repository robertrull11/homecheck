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

const PARSERS = [parseDeutscheBank];

export async function readStatement(file) {
  const pages = await pdfToPages(file);
  for (const parse of PARSERS) {
    const res = parse(pages);
    if (res) return res;
  }
  return null;
}

// Fechas reales: el año del extracto (si un movimiento es de un mes posterior al del extracto, es del año anterior)
export function datedLines(parsed, year) {
  const stmtMonth = parsed.statement?.m ?? 12;
  return parsed.lines.map((l) => {
    const y = l.month > stmtMonth ? year - 1 : year;
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
