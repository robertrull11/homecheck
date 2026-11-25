// Previsión de próximos cargos para el calendario.
// 1) Fijos (plantillas): fechas exactas según su frecuencia.
// 2) Recibos domiciliados que se repiten en el historial (p. ej. importados del banco):
//    se detecta cada cuánto llegan, el día habitual y el importe de los últimos meses.
import { conceptKey } from './bankImport.js';
import { FREQ_STEP } from './categories.js';
import { parseDate, makeDate, daysInMonth, todayStr } from './dates.js';

const mIndex = (y, m) => y * 12 + (m - 1);
const fromIndex = (i) => ({ y: Math.floor(i / 12), m: (i % 12) + 1 });
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const round2 = (n) => Math.round(n * 100) / 100;
const words = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z]+/).filter((w) => w.length >= 4);

// Fechas de un fijo entre dos fechas (incluidas)
export function templateDates(t, from, to) {
  if (t.active === false || !t.startDate) return [];
  const step = FREQ_STEP[t.frequency] || 1;
  const start = parseDate(t.startDate);
  const day = t.day || start.d;
  const out = [];
  for (let k = 0; k < 400; k++) {
    const idx = mIndex(start.y, start.m) + k * step;
    const { y, m } = fromIndex(idx);
    const date = makeDate(y, m, Math.min(day, daysInMonth(y, m)));
    if (date > to || (t.endDate && date > t.endDate)) break;
    if (date >= from) out.push(date);
  }
  return out;
}

// Recibos que se repiten en el historial
export function detectRecurring(transactions, today = todayStr()) {
  const groups = new Map();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.templateId || tx.linkedFrom || !tx.date || tx.date > today) continue;
    const key = conceptKey(tx.concept || '');
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }
  const t = parseDate(today);
  const todayIdx = mIndex(t.y, t.m);
  const out = [];
  for (const [key, list] of groups) {
    const months = new Map();
    for (const tx of list) {
      const d = parseDate(tx.date);
      const i = mIndex(d.y, d.m);
      const e = months.get(i) || { sum: 0, day: 31 };
      e.sum += Math.abs(tx.amount); e.day = Math.min(e.day, d.d);
      months.set(i, e);
    }
    const idx = [...months.keys()].sort((a, b) => a - b);
    if (idx.length < 3) continue;
    const gaps = idx.slice(1).map((v, i) => v - idx[i]);
    const period = Math.round(median(gaps));
    if (![1, 2, 3, 6, 12].includes(period)) continue;
    if (gaps.filter((g) => g === period).length / gaps.length < 0.6) continue;
    const lastIdx = idx[idx.length - 1];
    if (todayIdx - lastIdx > period * 2 + 1) continue;          // ya no se cobra
    const recent = idx.slice(-4);
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      key, period, lastIdx,
      day: Math.round(median(recent.map((i) => months.get(i).day))),
      amount: round2(median(idx.slice(-3).map((i) => months.get(i).sum))),
      concept: latest.concept, category: latest.category,
    });
  }
  return out;
}

// Lista de cargos previstos entre dos fechas
export function forecast({ templates = [], transactions = [], from, to, today = todayStr() }) {
  const items = [];
  const tplWords = [];
  for (const tpl of templates) {
    if (tpl.type !== 'expense' || tpl.active === false) continue;
    tplWords.push(words(tpl.concept));
    for (const date of templateDates(tpl, from, to)) {
      items.push({ date, concept: tpl.concept, amount: tpl.amount, category: tpl.category, kind: 'fixed', id: `${tpl.id}_${date}` });
    }
  }
  const toD = parseDate(to);
  const toIdx = mIndex(toD.y, toD.m);
  for (const r of detectRecurring(transactions, today)) {
    if (tplWords.some((ws) => ws.some((w) => r.key.includes(w)))) continue;   // ya está como fijo
    for (let i = r.lastIdx + r.period; i <= toIdx; i += r.period) {
      const { y, m } = fromIndex(i);
      const date = makeDate(y, m, Math.min(r.day, daysInMonth(y, m)));
      if (date < from || date <= today) continue;
      items.push({ date, concept: r.concept, amount: r.amount, category: r.category, kind: 'estimated', id: `${r.key}_${date}` });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
}
