// V4 · Comparativa entre años: el año elegido frente al anterior, en € y en %.
import { useEffect, useMemo, useState } from 'react';
import { LuCalendarRange, LuTrendingUp, LuTrendingDown } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CatIcon, SectionTitle, Segmented, Empty } from '../components/ui.jsx';
import { spendByCat, monthsWithData, round2 } from '../lib/finance.js';
import { monthName, parseDate, todayStr } from '../lib/dates.js';

const PREV_COLOR = '#7d9093'; // año anterior: gris (se resalta el año elegido con el color del espacio)

function incomeByCat(transactions, y, toMonth) {
  const out = {};
  for (const t of transactions) if (t.type === 'income' && t.year === y && t.month <= toMonth) out[t.category] = round2((out[t.category] || 0) + t.amount);
  return out;
}

function monthTotals(transactions, y) {
  const m = Array.from({ length: 12 }, () => ({ income: 0, expense: 0, saving: 0 }));
  for (const t of transactions) {
    if (t.year !== y) continue;
    const r = m[t.month - 1];
    if (t.type === 'income') r.income += t.amount; else if (t.type === 'saving') r.saving += t.amount; else r.expense += t.amount;
  }
  return m.map((r) => ({ income: round2(r.income), expense: round2(r.expense), saving: round2(r.saving) }));
}

export function CompareView({ year }) {
  const { t, money0, locale } = useI18n();
  const { transactions, catsForYear, incomeCats } = useData();
  const prevY = year - 1;
  const today = parseDate(todayStr());
  const isCurrent = year === today.y;
  const closedMonth = Math.max(1, today.m - 1);
  const [range, setRange] = useState(isCurrent ? 'ytd' : 'full');
  useEffect(() => { setRange(isCurrent ? 'ytd' : 'full'); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps
  const toMonth = range === 'ytd' ? closedMonth : 12;
  const [picked, setPicked] = useState(null);

  const cats = catsForYear(year);
  const hasPrev = useMemo(() => monthsWithData(transactions, prevY).size > 0, [transactions, prevY]);
  const hasNow = useMemo(() => monthsWithData(transactions, year).size > 0, [transactions, year]);

  const data = useMemo(() => {
    const mNow = monthTotals(transactions, year), mPrev = monthTotals(transactions, prevY);
    const sum = (arr, k) => round2(arr.slice(0, toMonth).reduce((a, r) => a + r[k], 0));
    const tot = (arr) => ({ income: sum(arr, 'income'), expense: sum(arr, 'expense'), saving: sum(arr, 'saving') });
    const now = tot(mNow), prev = tot(mPrev);
    now.free = round2(now.income - now.expense - now.saving); prev.free = round2(prev.income - prev.expense - prev.saving);
    const eNow = spendByCat(transactions, year, 1, toMonth), ePrev = spendByCat(transactions, prevY, 1, toMonth);
    const rows = cats.map((c) => ({ ...c, now: eNow[c.key] || 0, prev: ePrev[c.key] || 0 }))
      .filter((r) => r.now || r.prev)
      .map((r) => ({ ...r, diff: round2(r.now - r.prev) }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    const iNow = incomeByCat(transactions, year, toMonth), iPrev = incomeByCat(transactions, prevY, toMonth);
    const incomeRows = incomeCats.map((c) => ({ ...c, now: iNow[c.key] || 0, prev: iPrev[c.key] || 0 }))
      .filter((r) => r.now || r.prev).map((r) => ({ ...r, diff: round2(r.now - r.prev) }));
    const up = rows.filter((r) => r.diff > 0.5)[0] || null;
    const down = rows.filter((r) => r.diff < -0.5)[0] || null;
    return { mNow, mPrev, now, prev, rows, incomeRows, up, down };
  }, [transactions, year, prevY, toMonth, cats.map((c) => c.key).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasPrev || !hasNow) {
    return <Empty icon={LuCalendarRange} text={t('v4.no_data', { year: hasPrev ? year : prevY })} />;
  }

  const months = toMonth === 12 ? t('v4.full_year') : toMonth === 1 ? monthName(locale, 1) : `${monthName(locale, 1, 'short')}–${monthName(locale, toMonth, 'short')}`;
  const maxRow = Math.max(1, ...data.rows.flatMap((r) => [r.now, r.prev]));
  const maxMonth = Math.max(1, ...data.mNow.map((r) => r.expense), ...data.mPrev.map((r) => r.expense));
  const sel = picked != null ? { m: picked, now: data.mNow[picked - 1].expense, prev: data.mPrev[picked - 1].expense } : null;
  const shown = (m) => !isCurrent || m <= toMonth;

  return (
    <div>
      <p className="text-sm text-muted">{t('v4.intro', { year, prev: prevY })}</p>

      {isCurrent && (
        <Segmented className="mt-3" size="sm" value={range} onChange={(v) => { setRange(v); setPicked(null); }}
          options={[{ value: 'ytd', label: t('v4.range_ytd', { months: `${monthName(locale, 1, 'short')}–${monthName(locale, closedMonth, 'short')}` }) }, { value: 'full', label: t('v4.range_full') }]} />
      )}
      {isCurrent && range === 'full' && <p className="mt-2 text-xs leading-relaxed text-warn-ink">{t('v4.full_warning')}</p>}

      {/* Totales */}
      <div className="mt-4 grid grid-cols-1 gap-2">
        <TotalCard label={t('home.expense')} now={data.now.expense} prev={data.prev.expense} year={year} prevY={prevY} upIsBad />
        <div className="grid grid-cols-2 gap-2">
          <TotalCard small label={t('home.income')} now={data.now.income} prev={data.prev.income} year={year} prevY={prevY} />
          <TotalCard small label={t('v4.balance')} now={data.now.free} prev={data.prev.free} year={year} prevY={prevY} />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">{t('v4.period_note', { months, year, prev: prevY })}</p>

      {/* Lo que más cambia */}
      {(data.up || data.down) && (
        <>
          <SectionTitle>{t('v4.highlights')}</SectionTitle>
          <div className="card divide-y divide-hair">
            {data.up && <Highlight icon={LuTrendingUp} tone="text-danger" text={t('v4.most_up')} row={data.up} />}
            {data.down && <Highlight icon={LuTrendingDown} tone="text-income" text={t('v4.most_down')} row={data.down} />}
          </div>
        </>
      )}

      {/* Mes a mes */}
      <SectionTitle>{t('v4.by_month')}</SectionTitle>
      <div className="card p-4">
        <Legend year={year} prevY={prevY} />
        <div className="mt-3 flex h-36 items-end gap-1 border-b border-line" role="img" aria-label={t('v4.by_month')}>
          {data.mNow.map((r, i) => {
            const m = i + 1;
            const on = picked === m;
            return (
              <button key={m} onClick={() => setPicked(on ? null : m)} aria-pressed={on}
                title={`${monthName(locale, m)} · ${prevY}: ${money0(data.mPrev[i].expense)} · ${year}: ${shown(m) ? money0(r.expense) : '—'}`}
                className={`flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md ${on ? 'bg-black/[.06]' : 'hover:bg-black/[.04]'}`}>
                <span className="w-[40%] rounded-t-[3px]" style={{ height: `${(data.mPrev[i].expense / maxMonth) * 100}%`, background: PREV_COLOR }} />
                <span className="w-[40%] rounded-t-[3px] bg-[var(--accent)]" style={{ height: `${shown(m) ? (r.expense / maxMonth) * 100 : 0}%` }} />
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1">
          {data.mNow.map((_, i) => <span key={i} className={`flex-1 text-center text-[10px] ${picked === i + 1 ? 'font-bold text-ink' : 'text-muted'}`}>{monthName(locale, i + 1, 'narrow')}</span>)}
        </div>
        <p className="tabular mt-3 min-h-[2.5em] text-xs leading-snug text-muted">
          {sel ? (
            <span className="flex items-baseline justify-between gap-2">
              <span><b className="text-ink">{monthName(locale, sel.m)}</b> · {prevY}: {money0(sel.prev)} · {year}: {shown(sel.m) ? money0(sel.now) : '—'}</span>
              {shown(sel.m) && <Delta now={sel.now} before={sel.prev} upIsBad />}
            </span>
          ) : t('v4.tap_month')}
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--accent)]">{t('v4.see_table')}</summary>
          <table className="tabular mt-2 w-full text-xs">
            <thead><tr className="text-muted"><th className="py-1 text-left font-semibold"></th><th className="py-1 text-right font-semibold">{prevY}</th><th className="py-1 text-right font-semibold">{year}</th><th className="py-1 text-right font-semibold">{t('v4.diff')}</th></tr></thead>
            <tbody>
              {data.mNow.map((r, i) => (shown(i + 1) || data.mPrev[i].expense) ? (
                <tr key={i} className="border-t border-hair">
                  <td className="py-1.5 text-muted">{monthName(locale, i + 1)}</td>
                  <td className="py-1.5 text-right">{money0(data.mPrev[i].expense)}</td>
                  <td className="py-1.5 text-right">{shown(i + 1) ? money0(r.expense) : '—'}</td>
                  <td className="py-1.5 text-right">{shown(i + 1) ? <Delta now={r.expense} before={data.mPrev[i].expense} upIsBad /> : ''}</td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </details>
      </div>

      {/* Por categoría */}
      <SectionTitle right={<span className="text-xs text-muted">{months}</span>}>{t('v4.by_category')}</SectionTitle>
      <div className="card px-3.5 py-1">
        <Legend year={year} prevY={prevY} className="pt-3 pb-1" />
        {data.rows.map((r, i) => (
          <div key={r.key} className={`flex items-center gap-3 py-3 ${i < data.rows.length - 1 ? 'border-b border-hair' : ''}`}>
            <CatIcon label={r.label} color={r.color} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{r.label}</span>
                <Delta now={r.now} before={r.prev} upIsBad pct />
              </div>
              <PairBars prev={r.prev} now={r.now} max={maxRow} />
              <div className="tabular mt-1 flex justify-between text-[11px] text-muted">
                <span>{prevY}: {money0(r.prev)}</span>
                <span className="font-semibold text-ink">{year}: {money0(r.now)}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="tabular flex items-baseline justify-between gap-2 border-t border-line py-3 text-sm">
          <b>{t('v4.total')}</b>
          <span className="text-muted">{prevY}: {money0(data.prev.expense)} · <b className="text-ink">{year}: {money0(data.now.expense)}</b></span>
        </div>
      </div>

      {/* Ingresos */}
      {data.incomeRows.length > 0 && (
        <>
          <SectionTitle>{t('home.income_sources')}</SectionTitle>
          <div className="card divide-y divide-hair">
            {data.incomeRows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 px-4 py-3">
                <CatIcon label={r.label} color={r.color} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{r.label}</span>
                    <Delta now={r.now} before={r.prev} pct />
                  </div>
                  <div className="tabular mt-0.5 flex justify-between text-[11px] text-muted">
                    <span>{prevY}: {money0(r.prev)}</span>
                    <span className="font-semibold text-ink">{year}: {money0(r.now)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted">{t('v4.colors_hint')}</p>
    </div>
  );
}

function Legend({ year, prevY, className = '' }) {
  return (
    <div className={`flex gap-4 text-xs text-muted ${className}`}>
      <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PREV_COLOR }} />{prevY}</span>
      <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />{year}</span>
    </div>
  );
}

function PairBars({ prev, now, max }) {
  return (
    <div className="mt-1.5 space-y-[2px]" aria-hidden>
      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(prev ? 2 : 0, (prev / max) * 100)}%`, background: PREV_COLOR }} />
      <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(now ? 2 : 0, (now / max) * 100)}%` }} />
    </div>
  );
}

function TotalCard({ label, now, prev, year, prevY, upIsBad = false, small = false }) {
  const { money0 } = useI18n();
  return (
    <div className="card p-3.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`font-display tabular mt-0.5 font-bold tracking-tight ${small ? 'text-xl' : 'text-[28px]'} ${now < 0 ? 'text-danger' : ''}`}>{money0(now)}</p>
      <div className={`tabular mt-1 flex ${small ? 'flex-col gap-0.5' : 'items-baseline justify-between gap-2'} text-[11px] text-muted`}>
        <span>{prevY}: {money0(prev)}</span>
        <Delta now={now} before={prev} upIsBad={upIsBad} pct />
      </div>
      <span className="sr-only">{year}</span>
    </div>
  );
}

function Highlight({ icon: Icon, tone, text, row }) {
  const { money0 } = useI18n();
  const pct = row.prev > 0 ? Math.round((row.diff / row.prev) * 100) : null;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={20} className={`shrink-0 ${tone}`} />
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <span className="text-muted">{text}</span> <b>{row.label}</b>
        <span className={`tabular ml-1 font-bold ${tone}`}>{row.diff > 0 ? '+' : '−'}{money0(Math.abs(row.diff))}{pct != null ? ` (${row.diff > 0 ? '+' : '−'}${Math.abs(pct)} %)` : ''}</span>
      </p>
    </div>
  );
}

// ▲/▼ con la diferencia. Para gastos subir es malo (rojo); para ingresos y balance, bueno (verde).
function Delta({ now, before, upIsBad = false, pct = false }) {
  const { t, money0 } = useI18n();
  const diff = round2(now - before);
  if (Math.abs(diff) < 0.5) return <span className="shrink-0 text-[11px] font-semibold text-muted">= {t('cmp.same')}</span>;
  const up = diff > 0;
  const bad = upIsBad ? up : !up;
  const p = before > 0 ? Math.round((diff / before) * 100) : null;
  return (
    <span className={`tabular shrink-0 text-[11px] font-bold ${bad ? 'text-danger' : 'text-income'}`}>
      {up ? '▲' : '▼'} {money0(Math.abs(diff))}{pct && p != null && Math.abs(p) >= 1 ? ` (${up ? '+' : '−'}${Math.abs(p)} %)` : ''}
    </span>
  );
}
