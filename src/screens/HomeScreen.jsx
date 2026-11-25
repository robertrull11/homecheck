import { useMemo, useState } from 'react';
import { LuChevronRight, LuWallet, LuTriangleAlert } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CatIcon, ProgressBar, SectionTitle, Toggle, Empty } from '../components/ui.jsx';
import { MovementRow } from '../components/MovementRow.jsx';
import { monthSummary, yearSummary, savingsRate, upcomingCharges, spendByCat, monthsWithData } from '../lib/finance.js';
import { monthName, parseDate, todayStr, daysInMonth } from '../lib/dates.js';

const PRORATE_KEY = 'casa-prorate';

export function HomeScreen({ period, setPeriod, openMovement, goTo }) {
  const [prorate, setProrateState] = useState(() => { try { return localStorage.getItem(PRORATE_KEY) === '1'; } catch { return false; } });
  const setProrate = (v) => { setProrateState(v); try { localStorage.setItem(PRORATE_KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  return period.mode === 'year'
    ? <YearView year={period.year} onPickMonth={(m) => setPeriod({ ...period, month: m, mode: 'month' })} />
    : <MonthView period={period} prorate={prorate} setProrate={setProrate} openMovement={openMovement} goTo={goTo} />;
}

function Hero({ title, income, expense, saving, free, pace }) {
  const { t, money } = useI18n();
  const rate = savingsRate(income, expense);
  return (
    <div className="flex flex-col gap-3.5 rounded-[24px] bg-[var(--accent)] p-5 text-white">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] opacity-85">{title}</p>
          <p className={`font-display tabular mt-1 text-[40px] leading-none font-bold tracking-tight ${free < 0 ? 'text-[#FFD7D2]' : ''}`}>{money(free)}</p>
        </div>
        {rate !== null && <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">{t('home.rate_short', { pct: rate })}</span>}
      </div>
      {pace && (
        <div>
          <div className="mb-1.5 flex justify-between text-xs opacity-90">
            <span>{t('home.spent_pct', { pct: pace.spentPct })}</span>
            {pace.day && <span>{t('home.day_of', { day: pace.day, days: pace.days })}</span>}
          </div>
          <div className="relative h-2.5 rounded-full bg-white/25">
            <div className="h-2.5 rounded-full bg-[var(--accent-bar)]" style={{ width: `${Math.min(100, pace.spentPct)}%` }} />
            {pace.day && <div className="absolute -top-1 h-[18px] w-0.5 bg-white" style={{ left: `${pace.dayPct}%` }} />}
          </div>
          {pace.day && <p className="mt-2 text-xs opacity-90">{pace.message}</p>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[['home.income', income], ['home.expense', expense], ['home.saving', saving]].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-[14px] bg-white/15 p-2.5">
            <p className="text-[11px] opacity-85">{t(k)}</p>
            <p className="tabular mt-0.5 truncate text-[15px] font-bold">{money(v)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({ period, prorate, setProrate, openMovement, goTo }) {
  const { t, money, locale } = useI18n();
  const { transactions, templates, catsForYear, kind } = useData();
  const expenseCats = catsForYear(period.year);
  const keys = expenseCats.map((c) => c.key);
  // Mismo mes del año anterior (solo si ese mes tiene datos).
  const prev = useMemo(() => (monthsWithData(transactions, period.year - 1).has(period.month)
    ? spendByCat(transactions, period.year - 1, period.month, period.month) : null), [transactions, period]);
  const prevLabel = `${monthName(locale, period.month, 'short')} ${period.year - 1}`;
  const s = useMemo(() => monthSummary(transactions, templates, period.year, period.month, prorate, keys), [transactions, templates, period, prorate, keys.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = useMemo(() => transactions
    .filter((x) => x.year === period.year && x.month === period.month)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5), [transactions, period]);
  const upcoming = useMemo(() => upcomingCharges(templates).slice(0, 8), [templates]);

  const budgeted = expenseCats.filter((c) => !c.system);
  const totalBudget = budgeted.reduce((a, c) => a + c.budget, 0);
  const spentBudgeted = budgeted.reduce((a, c) => a + (s.byCat[c.key] || 0), 0);
  const now = parseDate(todayStr());
  const isCurrent = now.y === period.year && now.m === period.month;
  let pace = null;
  if (totalBudget > 0) {
    const spentPct = Math.round((spentBudgeted / totalBudget) * 100);
    if (isCurrent) {
      const days = daysInMonth(period.year, period.month);
      const dayPct = Math.round((now.d / days) * 100);
      const diff = spentPct - dayPct;
      const message = diff > 3 ? t('home.pace_over', { n: diff }) : diff < -3 ? t('home.pace_under', { n: -diff }) : t('home.pace_ok');
      pace = { spentPct, day: now.d, days, dayPct, message };
    } else pace = { spentPct };
  }
  const near = budgeted.filter((c) => c.budget > 0 && (s.byCat[c.key] || 0) / c.budget >= 0.9)
    .map((c) => ({ ...c, pct: Math.round(((s.byCat[c.key] || 0) / c.budget) * 100) }));

  const weekday = (d) => { const { y, m, d: dd } = parseDate(d); return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(y, m - 1, dd)); };

  return (
    <div>
      <Hero title={t(kind === 'home' ? 'home.free_home' : 'home.free_me')} {...s} pace={pace} />

      {near.length > 0 && (
        <button onClick={() => goTo('movements', { type: 'expense', category: near[0].key })}
          className="mt-4 flex w-full items-start gap-3 rounded-2xl border border-warn-line bg-warn-soft px-3.5 py-3 text-left">
          <LuTriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" />
          <span className="text-[13px] leading-snug text-warn-ink">
            <b>{t('home.near_limit', { count: near.length })}</b> {near.map((c) => `${c.label} (${c.pct} %)`).join(', ')}
          </span>
        </button>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionTitle right={<button className="text-[13px] font-semibold text-[var(--accent)]" onClick={() => goTo('recurring')}>{t('nav.recurring')}</button>}>{t('home.upcoming')}</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {upcoming.map(({ tpl, date }) => (
              <button key={tpl.id} onClick={() => goTo('recurring')} className="card shrink-0 px-3 py-2.5 text-left">
                <p className="text-xs text-muted">{weekday(date)}</p>
                <p className="mt-0.5 max-w-[9rem] truncate text-sm font-semibold">{tpl.concept}</p>
                <p className={`tabular mt-0.5 text-sm font-bold ${tpl.type === 'income' ? 'text-income' : ''}`}>{tpl.type === 'income' ? '+' : '−'}{money(tpl.amount)}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <SectionTitle right={<span className="text-xs text-muted">{t('home.spent_of_budget')}</span>}>{t('home.where')}</SectionTitle>
      <div className="card px-3.5 py-1">
        {expenseCats.map((c, i) => {
          const spent = s.byCat[c.key] || 0;
          const diff = c.budget - spent;
          const pct = c.budget ? spent / c.budget : 0;
          const warn = !c.system && c.budget > 0 && pct >= 0.9;
          return (
            <button key={c.key} onClick={() => goTo('movements', { type: 'expense', category: c.key })}
              className={`flex w-full items-center gap-3 py-3 text-left ${i < expenseCats.length - 1 ? 'border-b border-hair' : ''}`}>
              <CatIcon label={c.label} color={c.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.label}</span>
                  <span className="tabular shrink-0 text-sm font-bold">{money(spent)}</span>
                </div>
                {c.system ? (
                  <p className="mt-1 text-[11px] text-muted">{t('contrib.row_note')}</p>
                ) : (
                  <>
                    <div className="mt-1.5 mb-1"><ProgressBar value={spent} max={c.budget} color={c.color} warn={warn} /></div>
                    <div className="flex justify-between gap-2 text-[11px] text-muted">
                      <span className={diff < 0 && c.budget ? 'font-bold text-danger' : warn ? 'font-bold text-warn' : ''}>
                        {!c.budget ? t('home.no_budget') : diff < 0 ? t('home.over', { amount: money(-diff) }) : warn ? t('home.at_pct', { pct: Math.round(pct * 100), amount: money(diff) }) : t('home.left', { amount: money(diff) })}
                      </span>
                      <span className="tabular shrink-0">
                        {s.estByCat[c.key] > 0 && <>{t('home.estimated', { amount: money(s.estByCat[c.key]) })} · </>}
                        {c.budget ? t(c.autoYear ? 'home.of_budget_auto' : 'home.of_budget', { amount: money(c.budget), year: c.autoYear }) : ''}
                      </span>
                    </div>
                    {prev && <VsLastYear label={prevLabel} now={spent} before={prev[c.key] || 0} />}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card mt-3 p-4">
        <Toggle checked={prorate} onChange={setProrate} label={t('home.prorate')} hint={t('home.prorate_hint')} />
      </div>

      <SectionTitle right={recent.length > 0 && (
        <button className="flex items-center text-[13px] font-semibold text-[var(--accent)]" onClick={() => goTo('movements')}>{t('home.see_all')} <LuChevronRight size={14} /></button>
      )}>{t('home.recent')}</SectionTitle>
      {recent.length ? (
        <div className="card divide-y divide-hair overflow-hidden">
          {recent.map((tx) => <MovementRow key={tx.id} tx={tx} showDate onEdit={openMovement} />)}
        </div>
      ) : <Empty icon={LuWallet} text={t('home.empty')} />}
    </div>
  );
}

function YearView({ year, onPickMonth }) {
  const { t, money, money0, locale } = useI18n();
  const { transactions, catsForYear, incomeCats } = useData();
  const expenseCats = catsForYear(year);
  const keys = expenseCats.map((c) => c.key);
  const s = useMemo(() => yearSummary(transactions, year, keys), [transactions, year, keys.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  // Comparación con el año anterior. El año en curso se compara con el mismo periodo hasta el último mes
  // cerrado (el extracto del mes en curso aún no ha llegado y la comparación saldría engañosa).
  const today = parseDate(todayStr());
  const toMonth = year === today.y ? Math.max(1, today.m - 1) : 12;
  const cmp = useMemo(() => {
    if (!monthsWithData(transactions, year - 1).size) return null;
    const before = spendByCat(transactions, year - 1, 1, toMonth);
    const now = spendByCat(transactions, year, 1, toMonth);
    const sum = (o) => Object.entries(o).filter(([k]) => expenseCats.some((c) => c.key === k && !c.system)).reduce((a, [, v]) => a + v, 0);
    return { before, now, totalBefore: sum(before), totalNow: sum(now) };
  }, [transactions, year, toMonth, keys.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmpMonths = toMonth === 1 ? monthName(locale, 1, 'short') : `${monthName(locale, 1, 'short')}–${monthName(locale, toMonth, 'short')}`;
  const cmpLabel = toMonth === 12 ? String(year - 1) : `${cmpMonths} ${year - 1}`;
  const max = Math.max(1, ...s.months.map((m) => Math.max(m.income, m.expense)));
  const incomeByCat = useMemo(() => {
    const out = {};
    for (const tx of transactions) if (tx.type === 'income' && tx.year === year) out[tx.category] = (out[tx.category] || 0) + tx.amount;
    return out;
  }, [transactions, year]);

  return (
    <div>
      <Hero title={t('home.free_year')} income={s.income} expense={s.expense} saving={s.saving} free={s.free} />

      <SectionTitle>{t('home.monthly_evolution')}</SectionTitle>
      <div className="card p-4">
        <div className="mb-3 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />{t('home.income')}</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3d4f53]" />{t('home.expense')}</span>
        </div>
        <div className="flex h-40 items-end gap-1 border-b border-line" role="img" aria-label={t('home.monthly_evolution')}>
          {s.months.map((m) => (
            <button key={m.month} onClick={() => onPickMonth(m.month)}
              title={`${monthName(locale, m.month)} · ${t('home.income')}: ${money(m.income)} · ${t('home.expense')}: ${money(m.expense)}`}
              className="flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md hover:bg-black/[.04]">
              <span className="w-[42%] rounded-t-[4px] bg-[var(--accent)]" style={{ height: `${(m.income / max) * 100}%` }} />
              <span className="w-[42%] rounded-t-[4px] bg-[#3d4f53]" style={{ height: `${(m.expense / max) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1">
          {s.months.map((m) => <span key={m.month} className="flex-1 text-center text-[10px] text-muted">{monthName(locale, m.month, 'narrow')}</span>)}
        </div>
        <table className="mt-3 w-full text-xs">
          <tbody>
            {s.months.filter((m) => m.income || m.expense).map((m) => (
              <tr key={m.month} className="border-t border-hair">
                <td className="py-1.5 text-muted">{monthName(locale, m.month)}</td>
                <td className="tabular py-1.5 text-right text-income">{money0(m.income)}</td>
                <td className="tabular py-1.5 text-right">{money0(m.expense)}</td>
                <td className={`tabular py-1.5 text-right font-semibold ${m.income - m.expense < 0 ? 'text-danger' : ''}`}>{money0(m.income - m.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cmp && (
        <div className="card mt-4 px-4 py-3">
          <p className="text-xs font-semibold text-muted">{t(toMonth === 12 ? 'cmp.title_year' : 'cmp.title_ytd', { year: year - 1, months: cmpMonths })}</p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="tabular text-sm"><b>{year}: {money0(cmp.totalNow)}</b> <span className="text-muted">· {year - 1}: {money0(cmp.totalBefore)}</span></span>
            <Delta now={cmp.totalNow} before={cmp.totalBefore} pct />
          </div>
        </div>
      )}

      <SectionTitle right={cmp ? <span className="text-xs text-muted">{t('cmp.vs', { period: cmpLabel })}</span> : null}>{t('home.where')}</SectionTitle>
      <div className="card px-3.5 py-1">
        {expenseCats.map((c, i) => {
          const spent = s.byCat[c.key] || 0;
          const budget = c.budget * 12;
          return (
            <div key={c.key} className={`flex items-center gap-3 py-3 ${i < expenseCats.length - 1 ? 'border-b border-hair' : ''}`}>
              <CatIcon label={c.label} color={c.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.label}</span>
                  <span className="tabular shrink-0 text-sm font-bold">{money0(spent)}</span>
                </div>
                {!c.system && <div className="mt-1.5"><ProgressBar value={spent} max={budget} color={c.color} /></div>}
                <div className="tabular mt-1 text-right text-[11px] text-muted">{c.system ? '' : budget ? `${t('home.year_budget')}: ${money0(budget)}${c.autoYear ? ` · ${t('home.budget_auto_tag', { year: c.autoYear })}` : ''}` : t('home.no_budget')}</div>
                {cmp && !c.system && (toMonth === 12
                  ? <VsLastYear label={String(year - 1)} now={spent} before={cmp.before[c.key] || 0} round />
                  : <VsLastYear label={`${cmpMonths} ${year}: ${money0(cmp.now[c.key] || 0)} · ${year - 1}`} now={cmp.now[c.key] || 0} before={cmp.before[c.key] || 0} round />)}
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>{t('home.income_sources')}</SectionTitle>
      <div className="card divide-y divide-hair">
        {incomeCats.map((c) => (
          <div key={c.key} className="flex items-center gap-3 px-4 py-3">
            <CatIcon label={c.label} color={c.color} size={32} />
            <span className="flex-1 text-sm font-semibold">{c.label}</span>
            <span className="tabular text-sm font-bold text-income">{money0(incomeByCat[c.key] || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// «nov 2025: 1.020 € · ▲ 52 €»: más gasto que el año anterior en rojo, menos en verde.
function VsLastYear({ label, now, before, round = false }) {
  const { money, money0 } = useI18n();
  const fmt = round ? money0 : money;
  if (!now && !before) return null;
  return (
    <div className="tabular mt-0.5 flex justify-between gap-2 text-[11px] text-muted">
      <span className="truncate">{label}: {fmt(before)}</span>
      <Delta now={now} before={before} round={round} />
    </div>
  );
}

function Delta({ now, before, pct = false, round = false }) {
  const { t, money, money0 } = useI18n();
  const diff = Math.round((now - before) * 100) / 100;
  if (Math.abs(diff) < 0.5) return <span className="shrink-0 text-[11px] font-semibold text-muted">= {t('cmp.same')}</span>;
  const up = diff > 0;
  const p = before > 0 ? Math.round((diff / before) * 100) : null;
  const amount = (round || pct ? money0 : money)(Math.abs(diff));
  return (
    <span className={`tabular shrink-0 text-[11px] font-bold ${up ? 'text-danger' : 'text-income'}`} title={t(up ? 'cmp.more' : 'cmp.less')}>
      {up ? '▲' : '▼'} {amount}{pct && p != null && Math.abs(p) >= 1 ? ` (${up ? '+' : '−'}${Math.abs(p)} %)` : ''}
    </span>
  );
}
