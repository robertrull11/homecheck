// V3 · Lectura de tickets en el propio móvil.
// - readReceiptImage: OCR con Tesseract.js (código abierto) dentro del navegador. La primera vez descarga
//   el lector y el idioma (se guardan en el móvil); la foto nunca sale del dispositivo.
// - parseReceiptText: saca comercio, fecha, total y tipo de compra del texto (leído o pegado).

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js';

// Reduce la foto y la pasa a escala de grises con algo más de contraste: el OCR acierta más y va más rápido.
async function prepareImage(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function readReceiptImage(file, onProgress = () => {}) {
  const canvas = await prepareImage(file);
  const mod = await import(/* @vite-ignore */ TESSERACT);
  const { createWorker } = mod.default || mod;
  const worker = await createWorker('spa', 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(Math.round((m.progress || 0) * 100)); },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

// ── Interpretar el texto ──
const STORES = [
  // [nombre que se muestra, patrón, tipo]
  ['Mercadona', /MERCADONA/, 'grocery'], ['Lidl', /\bLIDL\b/, 'grocery'], ['Aldi', /\bALDI\b/, 'grocery'],
  ['Carrefour', /CARREFOUR/, 'grocery'], ['Caprabo', /CAPRABO/, 'grocery'], ['Bonpreu', /BON\s?PREU/, 'grocery'],
  ['Esclat', /ESCLAT/, 'grocery'], ['Condis', /CONDIS/, 'grocery'], ['Consum', /\bCONSUM\b/, 'grocery'],
  ['Dia', /\bDIA\s?(%|RETAIL|SUPERMERCADO)|SUPERMERCADOS DIA/, 'grocery'], ['Eroski', /EROSKI/, 'grocery'],
  ['Ametller Origen', /AMETLLER/, 'grocery'], ['Veritas', /VERITAS/, 'grocery'], ['Plusfresc', /PLUSFRESC/, 'grocery'],
  ['Sorli', /SORLI/, 'grocery'], ['bonÀrea', /BON\s?AREA|GUISSONA/, 'grocery'], ['La Sirena', /LA SIRENA/, 'grocery'],
  ['Alcampo', /ALCAMPO/, 'grocery'], ['Hipercor', /HIPERCOR/, 'grocery'], ['Supercor', /SUPERCOR/, 'grocery'], ['Makro', /\bMAKRO\b/, 'grocery'],
  ['Repsol', /REPSOL/, 'fuel'], ['Cepsa', /CEPSA|MOEVE/, 'fuel'], ['BP', /\bBP\b|BP OIL/, 'fuel'], ['Galp', /\bGALP\b/, 'fuel'],
  ['Shell', /\bSHELL\b/, 'fuel'], ['Petronor', /PETRONOR/, 'fuel'], ['Ballenoil', /BALLENOIL/, 'fuel'], ['Plenoil', /PLENOIL/, 'fuel'],
  ['Farmacia', /FARMACIA|FARMACIA|FARMÀCIA|PARAFARMACIA/, 'pharmacy'],
  ['IKEA', /\bIKEA\b/, 'home_goods'], ['Leroy Merlin', /LEROY MERLIN/, 'home_goods'], ['Bricomart', /BRICOMART/, 'home_goods'],
  ['Bauhaus', /BAUHAUS/, 'home_goods'], ['Action', /\bACTION\b/, 'home_goods'], ['MediaMarkt', /MEDIA\s?MARKT/, 'home_goods'],
  ['Decathlon', /DECATHLON/, 'clothes'], ['Primark', /PRIMARK/, 'clothes'], ['Zara', /\bZARA\b/, 'clothes'], ['H&M', /\bH\s?&\s?M\b/, 'clothes'],
  ['El Corte Inglés', /CORTE INGL/, 'clothes'],
];
const RESTAURANT = /RESTAURANT|RESTAURANTE|\bBAR\b|CAFETER|CAFE\b|PIZZ|BURGER|MC\s?DONALD|TAPAS|BRASERIA|CERVECER|FRANKFURT/;
const NOT_MERCHANT = /FACTURA|SIMPLIFICADA|TICKET|TIQUET|N\.?I\.?F|C\.?I\.?F|TEL[EÉ:.]|^C\/|CALLE|CARRER|AVDA|AV\.|PLAZA|PLA[CÇ]A|WWW|HTTP|@|FECHA|DATA|HORA|CAJA|CAIXA|OPERADOR|ATENDIDO|^\d/;
const AMOUNT = /(?<!\d)(\d{1,4}(?:[.\s]\d{3})*[.,]\d{2})(?!\d)/g;
const TOTAL_WORDS = /TOTAL|IMPORTE|IMPORT\b|A PAGAR|PAGAR|TARJETA|TARGETA|EFECTIVO|EFECTIU|VISA|MASTERCARD|CONTACTLESS|COBRADO/;
const NOT_TOTAL = /SUBTOTAL|BASE|IVA|I\.V\.A|CUOTA|QUOTA|DESCUENTO|DESCOMPTE|AHORRO|ESTALVI|CAMBIO|CANVI|ENTREGADO|ENTREGAT|PUNTOS|PUNTS|DEVOL/;

const toNumber = (s) => {
  let v = s.replace(/\s/g, '');
  v = /,\d{2}$/.test(v) ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).trim();

export function parseReceiptText(text, today = new Date()) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const upper = lines.map(norm);
  const whole = upper.join('\n');

  // Comercio y tipo de compra
  let merchant = '', kind = '';
  const store = STORES.find(([, re]) => re.test(whole));
  if (store) { merchant = store[0]; kind = store[2]; }
  else {
    const i = upper.findIndex((l) => /[A-Z]{3,}/.test(l) && !NOT_MERCHANT.test(l) && l.replace(/[^A-Z]/g, '').length >= 4);
    if (i >= 0) merchant = titleCase(lines[i].replace(/[^\p{L}\p{N}&'.\s-]/gu, '').slice(0, 40));
    if (RESTAURANT.test(whole)) kind = 'restaurant';
  }

  // Total: primero las líneas con «TOTAL», «A PAGAR», «TARJETA»…; si no, el importe que más se repite / el mayor.
  const amountsIn = (l) => [...l.matchAll(AMOUNT)].map((m) => toNumber(m[1])).filter((n) => n > 0 && n < 10000);
  let total = null;
  const candidates = [];
  upper.forEach((l, i) => {
    if (!TOTAL_WORDS.test(l) || NOT_TOTAL.test(l)) return;
    let nums = amountsIn(l);
    if (!nums.length && upper[i + 1] && !NOT_TOTAL.test(upper[i + 1])) nums = amountsIn(upper[i + 1]); // importe en la línea siguiente
    if (nums.length) candidates.push({ n: nums[nums.length - 1], strong: /TOTAL|A PAGAR/.test(l) });
  });
  if (candidates.length) {
    const strong = candidates.filter((c) => c.strong);
    total = Math.max(...(strong.length ? strong : candidates).map((c) => c.n));
  } else {
    const all = upper.flatMap(amountsIn);
    if (all.length) {
      const counts = new Map();
      all.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
      const repeated = [...counts.entries()].filter(([, c]) => c >= 2).map(([n]) => n);
      total = repeated.length ? Math.max(...repeated) : Math.max(...all);
    }
  }

  // Fecha (dd/mm/aa o dd-mm-aaaa); se descartan fechas futuras o de hace más de un año.
  let date = '';
  for (const m of whole.matchAll(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?!\d)/g)) {
    const d = +m[1], mo = +m[2];
    let y = +m[3]; if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    const dt = new Date(y, mo - 1, d);
    const diff = (today - dt) / 864e5;
    if (diff < -1 || diff > 400) continue;
    date = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    break;
  }

  return { merchant, kind, total: total != null ? Math.round(total * 100) / 100 : null, date };
}

// Tipo de compra → categoría de cada espacio (si existe en ese espacio).
const KIND_TO_CAT = {
  home: { grocery: 'food', home_goods: 'food', fuel: 'transport', pharmacy: 'leisure', restaurant: 'leisure', clothes: 'leisure' },
  personal: { grocery: 'other_p', home_goods: 'other_p', fuel: 'transport_p', pharmacy: 'sport_health', restaurant: 'leisure_out', clothes: 'clothes' },
};
export function categoryForReceipt(kind, space, cats) {
  const key = KIND_TO_CAT[space === 'home' ? 'home' : 'personal'][kind];
  return key && cats.some((c) => c.key === key) ? key : null;
}
