// V3 · Asesor automático: avisos calculados con reglas a partir de los movimientos (sin IA y sin enviar nada fuera).
// Cada aviso: { id, level: 'warn' | 'info' | 'good', title, text }.
import { conceptKey } from './bankImport.js';
import { todayStr } from './dates.js';

const idx = (y, m) => y * 12 + (m - 1);
const ym = (i) => ({ y: Math.floor(i / 12), m: (i % 12) + 1 });
const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const r2 = (n) => Math.round(n * 100) / 100;
const stable = (vals) => { const md = median(vals); return md > 0 && (Math.max(...vals) - Math.min(...vals)) / md <= 0.15; };

// Agrupa los gastos por concepto normalizado y por mes.
function groupByConcept(expenses) {
  const groups = new Map();
  for (const tx of expenses) {
    const key = conceptKey(tx.concept || '');
    if (!key) continue;
    let g = groups.get(key);
    if (!g) { g = { key, concept: tx.concept, category: tx.category, months: new Map(), list: [] }; groups.set(key, g); }
    g.list.push(tx);
    const i = idx(tx.year, tx.month);
    const e = g.months.get(i) || { sum: 0, count: 0, amounts: [], firstDay: 31 };
    e.sum += tx.amount; e.count += 1; e.amounts.push(tx.amount); e.firstDay = Math.min(e.firstDay, +tx.date.slice(8, 10));
    g.months.set(i, e);
    if (tx.date > (g.lastDate || '')) { g.lastDate = tx.date; g.concept = tx.concept; g.category = tx.category; }
  }
  return [...groups.values()];
}

export function advise({ transactions, cats = [], kind = 'home', today = todayStr(), t, money0, monthName }) {
  const out = [];
  const expenses = transactions.filter((x) => x.type === 'expense' && x.date && x.date <= today && !x.linkedFrom);
  const all = transactions.filter((x) => x.date && x.date <= today);
  if (!all.length) return out;

  // Último mes con datos (los extractos llegan con retraso) y ventana de 12 meses hasta él.
  const end = Math.max(...all.map((x) => idx(x.year, x.month)));
  const start12 = end - 11;
  const monthsWithData = new Set(all.map((x) => idx(x.year, x.month)));
  const mLabel = (i) => { const { y, m } = ym(i); return `${monthName(m, 'short')} ${y}`; };
  const groups = groupByConcept(expenses);

  // 1) Recibos mensuales que suben (o bajan): mediana de los 3 últimos meses frente a los mismos meses de hace un año.
  for (const g of groups) {
    const present = [...g.months.keys()].filter((i) => i >= start12 && i <= end);
    if (present.length < 9) continue; // solo recibos que llegan casi todos los meses
    const nowMonths = [end, end - 1, end - 2].filter((i) => g.months.has(i));
    const beforeMonths = [end - 12, end - 13, end - 14].filter((i) => g.months.has(i));
    if (nowMonths.length < 2 || beforeMonths.length < 2) continue;
    const now = median(nowMonths.map((i) => g.months.get(i).sum));
    const before = median(beforeMonths.map((i) => g.months.get(i).sum));
    // Solo recibos de importe estable (cuotas, tarifas): si varían mucho de un mes a otro (colegio, luz) no se compara.
    if (!stable(nowMonths.map((i) => g.months.get(i).sum)) || !stable(beforeMonths.map((i) => g.months.get(i).sum))) continue;
    const diff = now - before;
    const pct = before > 0 ? Math.round((diff / before) * 100) : 0;
    if (Math.abs(pct) < 8 || Math.abs(diff) < 5) continue;
    const vars = { concept: g.concept, before: money0(before), now: money0(now), pct: Math.abs(pct), since: mLabel(end - 12) };
    out.push(diff > 0
      ? { id: `up_${g.key}`, level: 'warn', score: 50 + Math.min(40, Math.abs(diff)), title: t('adv.up_title', vars), text: t('adv.up_text', vars) }
      : { id: `down_${g.key}`, level: 'good', score: 10 + Math.min(20, Math.abs(diff) / 5), title: t('adv.down_title', vars), text: t('adv.down_text', vars) });
  }

  // 2) Recibos cobrados en varios trozos (suele pasar cuando no hay saldo el día del cobro).
  for (const g of groups) {
    const ms = [...g.months.entries()].filter(([i]) => i >= start12 && i <= end);
    if (ms.length < 6) continue;
    const usualCount = Math.round(median(ms.map(([, e]) => e.count)));
    const usualSum = median(ms.map(([, e]) => e.sum));
    const usualDay = Math.round(median(ms.map(([, e]) => e.firstDay)));
    if (ms.filter(([, e]) => Math.abs(e.sum - usualSum) <= usualSum * 0.05).length < ms.length * 0.6) continue; // importe mensual estable
    const split = ms.filter(([, e]) => e.count > usualCount && Math.abs(e.sum - usualSum) <= usualSum * 0.15).map(([i]) => i).sort((a, b) => a - b);
    if (!split.length) continue;
    const vars = { concept: g.concept, months: split.map(mLabel).join(', '), day: usualDay };
    out.push({ id: `split_${g.key}`, level: 'warn', score: 85, title: t('adv.split_title', vars), text: t('adv.split_text', vars) });
  }

  // 3) Posible cargo duplicado: mismo recibo, mismo importe y mismo día en los últimos 60 días,
  //    cuando ese recibo no suele llegar dos veces al mes.
  const recent = expenses.filter((x) => idx(x.year, x.month) >= end - 1);
  const seen = new Map();
  for (const x of recent) {
    const k = `${conceptKey(x.concept || '')}|${x.amount}|${x.date}`;
    seen.set(k, [...(seen.get(k) || []), x]);
  }
  for (const [k, list] of seen) {
    if (list.length < 2) continue;
    const g = groups.find((gr) => gr.key === k.split('|')[0]);
    const usual = g ? median([...g.months.values()].map((e) => e.count)) : 1;
    if (usual >= 2) continue; // p. ej. dos recibos iguales del colegio cada mes
    const x = list[0];
    const vars = { concept: x.concept, amount: money0(x.amount), date: `${+x.date.slice(8, 10)} ${monthName(x.month, 'short')}` };
    out.push({ id: `dup_${k}`, level: 'warn', score: 95, title: t('adv.dup_title', vars), text: t('adv.dup_text', vars) });
  }

  // 4) Pagos que no son mensuales y que el año pasado llegaron en los dos próximos meses.
  const td = { y: +today.slice(0, 4), m: +today.slice(5, 7) };
  for (const ahead of [1, 2]) {
    const target = idx(td.y, td.m) + ahead;
    const lastYear = target - 12;
    if (!monthsWithData.has(lastYear)) continue;
    const items = [];
    for (const g of groups) {
      const e = g.months.get(lastYear);
      if (!e || e.sum < 100) continue;
      const count12 = [...g.months.keys()].filter((i) => i > lastYear - 12 && i <= lastYear).length;
      if (count12 > 6) continue; // es casi mensual: ya sale en el calendario
      items.push({ concept: g.concept, amount: e.sum });
    }
    if (!items.length) continue;
    items.sort((a, b) => b.amount - a.amount);
    const total = items.reduce((s, it) => s + it.amount, 0);
    const { m } = ym(target);
    const vars = { month: monthName(m), total: money0(total), list: items.slice(0, 4).map((it) => `${it.concept} (${money0(it.amount)})`).join(', ') };
    out.push({ id: `ahead_${target}`, level: 'info', score: 70 - ahead, title: t('adv.ahead_title', vars), text: t('adv.ahead_text', vars) });
  }

  // 5) Categorías por encima de su media (último mes cerrado con datos).
  const endYM = ym(end);
  const spent = {};
  for (const x of expenses) if (idx(x.year, x.month) === end) spent[x.category] = (spent[x.category] || 0) + x.amount;
  const over = cats.filter((c) => !c.system && c.budget > 0 && (spent[c.key] || 0) > c.budget * 1.1 && (spent[c.key] || 0) - c.budget >= 20)
    .map((c) => ({ c, diff: spent[c.key] - c.budget })).sort((a, b) => b.diff - a.diff).slice(0, 3);
  for (const { c, diff } of over) {
    const vars = { category: c.label, month: monthName(endYM.m), spent: money0(spent[c.key]), budget: money0(c.budget), diff: money0(diff) };
    out.push({ id: `over_${c.key}_${end}`, level: 'warn', score: 40 + Math.min(30, diff / 10), title: t('adv.over_title', vars), text: t('adv.over_text', vars) });
  }

  // 6) Entradas frente a gastos de los últimos 12 meses con datos.
  const win = all.filter((x) => { const i = idx(x.year, x.month); return i >= start12 && i <= end; });
  const nMonths = new Set(win.map((x) => idx(x.year, x.month))).size;
  if (nMonths >= 3) {
    const inc = win.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0) / nMonths;
    const exp = win.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0) / nMonths;
    const gap = r2(exp - inc);
    const vars = { income: money0(inc), expense: money0(exp), gap: money0(Math.abs(gap)), half: money0(Math.abs(gap) / 2), months: nMonths };
    if (inc > 0 && gap > 10) {
      out.push({ id: 'balance', level: 'warn', score: 80, title: t(kind === 'home' ? 'adv.short_home_title' : 'adv.short_me_title', vars), text: t(kind === 'home' ? 'adv.short_home_text' : 'adv.short_me_text', vars) });
    } else if (inc > 0 && gap < -10) {
      out.push({ id: 'balance', level: 'good', score: 30, title: t('adv.surplus_title', vars), text: t(kind === 'home' ? 'adv.surplus_home_text' : 'adv.surplus_me_text', vars) });
    }
  }

  const order = { warn: 0, info: 1, good: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level] || b.score - a.score);
}

// V3 · Resumen sin datos personales para pegar en una IA (sin conceptos, nombres ni comercios: solo totales).
export function aiSummary({ transactions, cats = [], incomeCats = [], kind = 'home', today = todayStr(), t, money0, monthName }) {
  const all = transactions.filter((x) => x.date && x.date <= today);
  if (!all.length) return '';
  const end = Math.max(...all.map((x) => idx(x.year, x.month)));
  const months = Array.from({ length: 12 }, (_, k) => end - 11 + k).filter((i) => all.some((x) => idx(x.year, x.month) === i));
  const catLabel = (type, key) => ((type === 'income' ? incomeCats : cats).find((c) => c.key === key)?.label || key);
  const lines = [];
  lines.push(t(kind === 'home' ? 'ai.intro_home' : 'ai.intro_me'));
  lines.push('');
  lines.push(t('ai.budgets'));
  for (const c of cats) if (!c.system && c.budget > 0) lines.push(`- ${c.label}: ${money0(c.budget)}`);
  lines.push('');
  lines.push(t('ai.by_month'));
  for (const i of months) {
    const { y, m } = ym(i);
    const mx = all.filter((x) => x.year === y && x.month === m);
    const inc = mx.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
    const exp = mx.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
    const byCat = {};
    for (const x of mx) if (x.type === 'expense') byCat[x.category] = (byCat[x.category] || 0) + x.amount;
    const detail = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${catLabel('expense', k)} ${money0(v)}`).join(', ');
    lines.push(`- ${monthName(m)} ${y}: ${t('ai.in')} ${money0(inc)} · ${t('ai.out')} ${money0(exp)}${detail ? ` (${detail})` : ''}`);
  }
  const incByCat = {};
  for (const x of all) if (x.type === 'income' && months.includes(idx(x.year, x.month))) incByCat[x.category] = (incByCat[x.category] || 0) + x.amount;
  if (Object.keys(incByCat).length) {
    lines.push('');
    lines.push(t('ai.income_types'));
    for (const [k, v] of Object.entries(incByCat)) lines.push(`- ${catLabel('income', k)}: ${money0(v)}`);
  }
  lines.push('');
  lines.push(t('ai.question'));
  return lines.join('\n');
}
