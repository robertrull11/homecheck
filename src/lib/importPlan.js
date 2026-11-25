// Prepara la importación: propone categoría, detecta lo que ya está apuntado y los recibos que son fijos,
// y genera las operaciones para guardarlo todo de una vez.
import { cleanConcept, conceptKey, hash } from './bankImport.js';
import { contribOps, CONTRIB_CATEGORY, CONTRIB_INCOME } from './space.js';

// Pistas por palabras del concepto (solo se usan si esa categoría existe en el espacio).
const EXPENSE_HINTS = [
  [/ENDESA|IBERDROLA|NATURGY|HOLALUZ|SOM ENERGIA|TOTALENERGIES|AIGUES|AGUAS|AQUALIA|AGBAR|GAS NATURAL|VODAFONE|MOVISTAR|TELEFONICA|ORANGE|JAZZTEL|MASMOVIL|\bDIGI\b|FINETWORK|LOWI|PEPEPHONE|SIMYO|PRESTEC|PRESTAMO|HIPOTECA|LLOGUER|ALQUILER|COMUNIDAD|COMUNITAT|^(RECIBO |REBUT )?C P\b|\bIBI\b/, ['housing']],
  [/MERCADONA|BONPREU|ESCLAT|CONDIS|CAPRABO|LIDL|ALDI|CARREFOUR|\bDIA\b|CONSUM|EROSKI|ALCAMPO|HIPERCOR|SUPERMERCA|AMETLLER/, ['food']],
  [/REPSOL|CEPSA|GALP|\bBP\b|SHELL|PETRONOR|PLENOIL|BALLENOIL|PEATGE|PEAJE|AUTOPISTA|RENFE|\bFGC\b|PARKING|APARCAMENT|\bITV\b|TALLER/, ['transport', 'transport_p']],
  [/ADESLAS|SANITAS|ASISA|\bDKV\b|FARMACIA|NETFLIX|SPOTIFY|\bHBO\b|DISNEY|GIMNAS|GYM\b/, ['leisure', 'sport_health']],
  [/ZARA|MANGO|PRIMARK|BERSHKA|PULL BEAR|DECATHLON|KIABI/, ['clothes']],
];
const INCOME_HINTS = [
  [/NOMINA/, ['salary']],
  [/PAGA EXTRA/, ['bonus']],
  [/COBRO INMEDIATO|TRANSFERENCIA|TRASPASO|TRASPAS|BIZUM|\bTRF\b/, [CONTRIB_INCOME]],
];

// Para reconocer qué fijo es cada recibo: lo que el usuario llama "Luz" el banco lo llama "Endesa", etc.
const FIXED_GROUPS = [
  [/LUZ|LLUM|ELECTRIC/, /ENDESA|IBERDROLA|NATURGY|HOLALUZ|SOM ENERGIA|TOTALENERGIES|ELECTRIC/],
  [/AGUA|AIGUA/, /AIGUES|AGUAS|AQUALIA|AGBAR/],
  [/GAS\b/, /NATURGY|GAS NATURAL|REPSOL|NEDGIA/],
  [/INTERNET|MOVIL|MOBIL|TELEFON|FIBRA/, /VODAFONE|MOVISTAR|TELEFONICA|ORANGE|JAZZTEL|MASMOVIL|DIGI|FINETWORK|LOWI|PEPEPHONE|SIMYO/],
  [/HIPOTECA|PRESTAMO|PRESTEC|PRESTEC/, /PRESTEC|PRESTAMO|HIPOTECA/],
  [/COMUNIDAD|COMUNITAT|ESCALERA/, /COMUNIDAD|COMUNITAT|^(RECIBO |REBUT )?C P\b/],
  [/SEGURO|ASSEGURANC|MUTUA|SALUD|SALUT/, /ADESLAS|SANITAS|ASISA|DKV|MAPFRE|AXA|ALLIANZ|GENERALI|ZURICH|MUTUA|CATALANA OCCIDENTE|OCASO/],
  [/ESCOLA|ESCUELA|COLEGIO|COLE\b|FUNDACIO|COMEDOR|MENJADOR/, /FUNDACIO|ESCOLA|ESCUELA|COLEGIO|AMPA/],
];
const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
function looksLike(txConcept, key) {
  const c = norm(txConcept);
  if (FIXED_GROUPS.some(([mine, bank]) => mine.test(c) && bank.test(key))) return true;
  const words = c.split(/[^A-Z]+/).filter((w) => w.length >= 4);
  return words.some((w) => key.includes(w));
}

const dayDiff = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
const cents = (n) => Math.round(Math.abs(n) * 100);

function suggest(key, type, cats, rules) {
  const rule = rules[key];
  if (rule && rule.type === type && cats.some((c) => c.key === rule.category)) return rule.category;
  for (const [re, keys] of type === 'income' ? INCOME_HINTS : EXPENSE_HINTS) {
    if (re.test(key)) { const hit = keys.find((k) => cats.some((c) => c.key === k)); if (hit) return hit; }
  }
  if (type === 'income') return cats.some((c) => c.key === 'other_income') ? 'other_income' : '';
  return '';
}

// lines: movimientos con fecha (datedLines). Devuelve una fila por movimiento con lo propuesto.
export function planImport({ lines, transactions, expenseCats, incomeCats, rules = {} }) {
  const claimed = new Set();
  const seq = new Map();
  const byId = new Map(transactions.map((t) => [t.id, t]));
  return lines.map((l, index) => {
    const type = l.amount < 0 ? 'expense' : 'income';
    const amount = Math.abs(l.amount);
    const key = conceptKey(l.concept);
    const base = `${l.date}|${cents(amount)}|${type}|${key}`;
    const n = (seq.get(base) || 0) + 1; seq.set(base, n);   // dos recibos iguales el mismo día son dos movimientos
    const id = `imp_${hash(`${base}|${n}`)}`;
    const cats = type === 'income' ? incomeCats : expenseCats.filter((c) => !c.system || c.key === CONTRIB_CATEGORY);
    const row = {
      index, id, key, type, amount, date: l.date, year: +l.date.slice(0, 4), month: +l.date.slice(5, 7),
      concept: cleanConcept(l.concept), category: suggest(key, type, cats, rules),
      status: 'new', match: null, fixedOptions: [], action: 'new',
    };

    if (byId.has(id)) { row.status = 'imported'; row.action = 'skip'; return row; }

    const rule = rules[key];
    const isThisFixed = (t) => (rule?.templateId ? t.templateId === rule.templateId : looksLike(t.concept, key));
    const free = (t) => !claimed.has(t.id) && t.type === type;

    // ¿Ya apuntado a mano? Mismo tipo e importe y fecha muy cercana.
    const dup = transactions.find((t) => free(t) && !t.templateId && cents(t.amount) === cents(amount) && dayDiff(t.date, l.date) <= 3);
    // ¿Es un fijo ya apuntado con el mismo importe? Solo si el concepto encaja (luz ↔ Endesa…) o ya se aprendió.
    const dupFixed = !dup && transactions.find((t) => free(t) && t.templateId && cents(t.amount) === cents(amount)
      && dayDiff(t.date, l.date) <= 20 && isThisFixed(t));
    if (dup || dupFixed) { const m = dup || dupFixed; claimed.add(m.id); row.status = 'duplicate'; row.match = m; row.action = 'skip'; return row; }

    // Fijos de esas fechas: si encaja, se propone corregir el importe estimado con el real (p. ej. la luz).
    row.fixedOptions = transactions.filter((t) => free(t) && t.templateId && dayDiff(t.date, l.date) <= 20);
    const fixed = row.fixedOptions.find(isThisFixed);
    if (fixed) { claimed.add(fixed.id); row.status = 'fixed'; row.match = fixed; row.action = `fixed:${fixed.id}`; return row; }
    // Mismo importe que un fijo pero el concepto no encaja: se avisa y decide el usuario.
    const maybe = row.fixedOptions.find((t) => cents(t.amount) === cents(amount));
    if (maybe) { row.status = 'maybe'; row.match = maybe; }
    return row;
  });
}

// Operaciones de guardado (un único lote). También aprende cómo se ha clasificado cada concepto.
export function buildImportOps({ space, user, rows, rules = {}, contribConcept }) {
  const ops = [];
  const learned = { ...rules };
  for (const r of rows) {
    if (r.action === 'skip') continue;
    if (r.action.startsWith('fixed:')) {
      const tx = r.fixedOptions.find((t) => `fixed:${t.id}` === r.action) || r.match;
      if (!tx) continue;
      const patch = { amount: r.amount, date: r.date, year: r.year, month: r.month, updatedBy: user.email };
      ops.push({ type: 'update', path: space.path('transactions', tx.id), data: patch, stamp: 'update' });
      if (space.kind === 'personal') ops.push(...contribOps({ before: tx, after: { ...tx, ...patch }, personalTxId: tx.id, user, concept: contribConcept }));
      learned[r.key] = { type: r.type, category: tx.category, templateId: tx.templateId };
      continue;
    }
    const data = {
      type: r.type, category: r.category, concept: r.concept, amount: r.amount,
      date: r.date, year: r.year, month: r.month, notes: '', frequency: 'one-off', source: 'import', createdBy: user.email,
    };
    ops.push({ type: 'set', path: space.path('transactions', r.id), data, stamp: 'create' });
    if (space.kind === 'personal') ops.push(...contribOps({ before: null, after: data, personalTxId: r.id, user, concept: contribConcept }));
    learned[r.key] = { type: r.type, category: r.category };
  }
  if (ops.length) ops.push({ type: 'set', path: [...space.base, 'settings', 'main'], data: { importRules: learned }, merge: true });
  return ops;
}

export async function commitInChunks(space, ops, size = 400) {
  for (let i = 0; i < ops.length; i += size) await space.commit(ops.slice(i, i + size));
}
