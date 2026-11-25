import { FREQ_STEP } from './categories.js';
import { parseDate, makeDate, daysInMonth, addMonths, periodKey, dayDiff, quarterOf, todayStr } from './dates.js';

export const round2 = (n) => Math.round(n * 100) / 100;

export function parseAmount(text) {
  if (typeof text === 'number') return text;
  const clean = String(text).trim().replace(/\s/g, '').replace(/€/g, '');
  if (!clean) return NaN;
  // Admite "1.234,56", "1234,56", "1234.56" y "1,234.56"
  let normalized = clean;
  if (clean.includes(',') && clean.includes('.')) {
    normalized = clean.lastIndexOf(',') > clean.lastIndexOf('.')
      ? clean.replace(/\./g, '').replace(',', '.')
      : clean.replace(/,/g, '');
  } else if (clean.includes(',')) {
    normalized = clean.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? round2(n) : NaN;
}

export function inMonth(tx, y, m) {
  return tx.year === y && tx.month === m;
}

// ── Gastos fijos: fechas en las que toca generar un movimiento ──
export function dueOccurrences(template, today = todayStr(), max = 36) {
  if (!template.active || !template.startDate) return [];
  const step = FREQ_STEP[template.frequency] || 1;
  const start = parseDate(template.startDate);
  const day = template.day || start.d;
  const out = [];
  for (let k = 0; out.length < max; k++) {
    const { y, m } = addMonths(start.y, start.m, k * step);
    const date = makeDate(y, m, Math.min(day, daysInMonth(y, m)));
    if (date > today) break;
    const period = periodKey(y, m);
    if (template.lastPeriod && period <= template.lastPeriod) continue;
    if (template.endDate && date > template.endDate) break;
    out.push({ date, period, year: y, month: m });
  }
  return out;
}

export function nextOccurrence(template, today = todayStr()) {
  if (!template.startDate) return null;
  const step = FREQ_STEP[template.frequency] || 1;
  const start = parseDate(template.startDate);
  const day = template.day || start.d;
  for (let k = 0; k < 600; k++) {
    const { y, m } = addMonths(start.y, start.m, k * step);
    const date = makeDate(y, m, Math.min(day, daysInMonth(y, m)));
    const period = periodKey(y, m);
    if (template.lastPeriod && period <= template.lastPeriod) continue;
    if (template.endDate && date > template.endDate) return null;
    return date;
  }
  return null;
}

export function movementFromTemplate(template, occ, by) {
  return {
    type: template.type,
    category: template.category,
    concept: template.concept,
    amount: template.amount,
    date: occ.date,
    year: occ.year,
    month: occ.month,
    frequency: template.frequency,
    templateId: template.id,
    notes: template.notes || '',
    createdBy: by,
    auto: true,
    ...(template.shared ? { shared: template.shared } : {}),
  };
}

// ── Posibles duplicados: mismo tipo, mismo importe y fecha a ±3 días ──
export function findDuplicates(candidate, transactions, days = 3) {
  const amount = round2(Number(candidate.amount));
  return transactions.filter((t) =>
    t.id !== candidate.id &&
    t.type === candidate.type &&
    (candidate.type !== 'saving' || t.category === candidate.category) &&
    Math.abs(round2(t.amount) - amount) < 0.005 &&
    Math.abs(dayDiff(t.date, candidate.date)) <= days
  );
}

// ── Resumen de un mes ──
// prorate=true reparte los recibos trimestrales/anuales entre sus meses
// (y estima los que aún no han llegado a partir de los gastos fijos).
export function monthSummary(transactions, templates, y, m, prorate = false, catKeys = []) {
  const byCat = Object.fromEntries(catKeys.map((k) => [k, 0]));
  const estByCat = Object.fromEntries(catKeys.map((k) => [k, 0]));
  const incomeByCat = {};
  let income = 0, saving = 0;

  for (const t of transactions) {
    if (t.type === 'income' && inMonth(t, y, m)) {
      income += t.amount;
      incomeByCat[t.category] = (incomeByCat[t.category] || 0) + t.amount;
    } else if (t.type === 'saving' && inMonth(t, y, m)) {
      saving += t.amount;
    } else if (t.type === 'expense') {
      if (!prorate || t.frequency === 'monthly' || t.frequency === 'one-off' || !t.frequency) {
        if (inMonth(t, y, m)) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      } else if (t.frequency === 'annual' && t.year === y) {
        byCat[t.category] = (byCat[t.category] || 0) + t.amount / 12;
      } else if (t.frequency === 'quarterly' && t.year === y && quarterOf(t.month) === quarterOf(m)) {
        byCat[t.category] = (byCat[t.category] || 0) + t.amount / 3;
      }
    }
  }

  if (prorate) {
    for (const tpl of templates) {
      if (!tpl.active || tpl.type !== 'expense' || tpl.frequency === 'monthly') continue;
      if (!tpl.startDate || parseDate(tpl.startDate).y > y) continue;
      const already = transactions.some((t) => t.templateId === tpl.id && t.year === y &&
        (tpl.frequency === 'annual' || quarterOf(t.month) === quarterOf(m)));
      if (already) continue;
      const share = tpl.frequency === 'annual' ? tpl.amount / 12 : tpl.amount / 3;
      byCat[tpl.category] = (byCat[tpl.category] || 0) + share;
      estByCat[tpl.category] = (estByCat[tpl.category] || 0) + share;
    }
  }

  const expense = Object.values(byCat).reduce((a, b) => a + b, 0);
  return {
    income: round2(income), expense: round2(expense), saving: round2(saving),
    free: round2(income - expense - saving),
    byCat: mapRound(byCat), estByCat: mapRound(estByCat), incomeByCat: mapRound(incomeByCat),
  };
}

export function yearSummary(transactions, y, catKeys = []) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0, saving: 0 }));
  const byCat = Object.fromEntries(catKeys.map((k) => [k, 0]));
  for (const t of transactions) {
    if (t.year !== y) continue;
    const row = months[t.month - 1];
    if (t.type === 'income') row.income += t.amount;
    else if (t.type === 'saving') row.saving += t.amount;
    else { row.expense += t.amount; byCat[t.category] = (byCat[t.category] || 0) + t.amount; }
  }
  const total = months.reduce((a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense, saving: a.saving + r.saving }), { income: 0, expense: 0, saving: 0 });
  return {
    months: months.map((r) => ({ ...r, income: round2(r.income), expense: round2(r.expense), saving: round2(r.saving) })),
    income: round2(total.income), expense: round2(total.expense), saving: round2(total.saving),
    free: round2(total.income - total.expense - total.saving),
    byCat: mapRound(byCat),
  };
}

export function goalBalances(transactions) {
  const out = {};
  for (const t of transactions) if (t.type === 'saving') out[t.category] = round2((out[t.category] || 0) + t.amount);
  return out;
}

function mapRound(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round2(v)]));
}

// Tasa de ahorro = parte de los ingresos que no se ha gastado.
export function savingsRate(income, expense) {
  if (!income) return null;
  return Math.round(((income - expense) / income) * 100);
}

// Próximos cargos de los fijos activos en los próximos `days` días (para la tira del Resumen).
export function upcomingCharges(templates, today = todayStr(), days = 31) {
  const limit = new Date(today + 'T00:00:00');
  limit.setDate(limit.getDate() + days);
  const lim = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
  return templates
    .filter((t) => t.active !== false)
    .map((t) => ({ tpl: t, date: nextOccurrence(t, today) }))
    .filter((x) => x.date && x.date >= today && x.date <= lim)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Fijos del mes: cuántos ya se han apuntado y cuáles faltan.
export function monthFixedStatus(templates, transactions, y, m, today = todayStr()) {
  const items = [];
  for (const t of templates) {
    if (t.active === false || !t.startDate) continue;
    const step = FREQ_STEP[t.frequency] || 1;
    const s = parseDate(t.startDate);
    const diff = (y * 12 + m) - (s.y * 12 + s.m);
    if (diff < 0 || diff % step !== 0) continue;
    const date = makeDate(y, m, Math.min(t.day || s.d, daysInMonth(y, m)));
    const tx = transactions.find((x) => x.templateId === t.id && x.year === y && x.month === m);
    items.push({ tpl: t, date, tx, done: !!tx });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
