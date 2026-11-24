import { useMemo, useState } from 'react';
import { LuChevronRight, LuWallet } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CategoryIcon, ProgressBar, SectionTitle, Toggle, Empty } from '../components/ui.jsx';
import { MovementRow } from '../components/MovementRow.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories.js';
import { monthSummary, yearSummary, savingsRate } from '../lib/finance.js';
import { monthName } from '../lib/dates.js';

const PRORATE_KEY = 'casa-prorate';

export function HomeScreen({ period, setPeriod, openMovement, goTo }) {
  const { t } = useI18n();
  const [prorate, setProrateState] = useState(() => { try { return localStorage.getItem(PRORATE_KEY) === '1'; } catch { return false; } });
  const setProrate = (v) => { setProrateState(v); try { localStorage.setItem(PRORATE_KEY, v ? '1' : '0'); } catch { /* */ } };

  return period.mode === 'year'
    ? <YearView year={period.year} onPickMonth={(m) => setPeriod({ ...period, month: m, mode: 'month' })} />
    : <MonthView period={period} prorate={prorate} setProrate={setProrate} openMovement={openMovement} goTo={goTo} t={t} />;
}

function Totals({ income, expense, saving, free }) {
  const { t, money } = useI18n();
  const rate = savingsRate(income, expense);
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <p className="text-sm font-medium text-muted">{t('home.free')}</p>
        <p className={`tabular mt-1 text-4xl font-extrabold tracking-tight ${free < 0 ? 'text-danger' : ''}`}>{money(free)}</p>
        {rate !== null && (
          <span className="mt-2 inline-block rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            {t('home.savings_rate')}: {rate}%
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 border-t border-line text-center">
        {[['home.income', income, 'text-income'], ['home.expense', expense, ''], ['home.saving', saving, 'text-saving']].map(([k, v, c]) => (
          <div key={k} className="border-line px-2 py-3 not-last:border-r">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{t(k)}</p>
            <p className={`tabular mt-0.5 text-[15px] font-bold ${c}`}>{money(v)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({ period, prorate, setProrate, openMovement, goTo, t }) {
  const { money } = useI18n();
  const { transactions, templates, budgets } = useData();
  const s = useMemo(() => monthSummary(transactions, templates, period.year, period.month, prorate), [transactions, templates, period, prorate]);
  const recent = useMemo(() => transactions
    .filter((x) => x.year === period.year && x.month === period.month)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6), [transactions, period]);

  return (
    <div>
      <Totals {...s} />

      <SectionTitle>{t('home.by_category')}</SectionTitle>
      <div className="card divide-y divide-line">
        {EXPENSE_CATEGORIES.map((c) => {
          const spent = s.byCat[c.key] || 0;
          const budget = budgets[c.key] || 0;
          const diff = budget - spent;
          return (
            <button key={c.key} onClick={() => goTo('movements', { type: 'expense', category: c.key })} className="block w-full px-4 py-3.5 text-left active:bg-black/[.03]">
              <div className="flex items-center gap-3">
                <CategoryIcon type="expense" category={c.key} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{t(`cat.${c.key}`)}</span>
                    <span className="tabular shrink-0 text-sm font-bold">{money(spent)}</span>
                  </div>
                  <div className="mt-1.5"><ProgressBar value={spent} max={budget} color={c.color} /></div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted">
                    <span className={budget && diff < 0 ? 'font-semibold text-danger' : ''}>
                      {!budget ? t('home.no_budget') : diff < 0 ? t('home.over', { amount: money(-diff) }) : t('home.left', { amount: money(diff) })}
                    </span>
                    <span className="tabular">
                      {s.estByCat[c.key] > 0 && <>{t('home.estimated', { amount: money(s.estByCat[c.key]) })} · </>}
                      {budget ? t('home.of_budget', { amount: money(budget) }) : ''}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="card mt-3 p-4">
        <Toggle checked={prorate} onChange={setProrate} label={t('home.prorate')} hint={t('home.prorate_hint')} />
      </div>

      <SectionTitle right={recent.length > 0 && (
        <button className="flex items-center text-xs font-semibold text-brand" onClick={() => goTo('movements')}>
          {t('home.see_all')} <LuChevronRight size={14} />
        </button>
      )}>{t('home.recent')}</SectionTitle>
      {recent.length ? (
        <div className="card divide-y divide-line overflow-hidden">
          {recent.map((tx) => <MovementRow key={tx.id} tx={tx} showDate onClick={() => openMovement(tx)} />)}
        </div>
      ) : <Empty icon={LuWallet} text={t('home.empty')} />}
    </div>
  );
}

function YearView({ year, onPickMonth }) {
  const { t, money, money0, locale } = useI18n();
  const { transactions, budgets } = useData();
  const s = useMemo(() => yearSummary(transactions, year), [transactions, year]);
  const max = Math.max(1, ...s.months.map((m) => Math.max(m.income, m.expense)));
  const incomeByCat = useMemo(() => {
    const out = {};
    for (const tx of transactions) if (tx.type === 'income' && tx.year === year) out[tx.category] = (out[tx.category] || 0) + tx.amount;
    return out;
  }, [transactions, year]);

  return (
    <div>
      <Totals income={s.income} expense={s.expense} saving={s.saving} free={s.free} />

      <SectionTitle>{t('home.monthly_evolution')}</SectionTitle>
      <div className="card p-4">
        <div className="mb-3 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-income" />{t('home.income')}</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3d3a35]" />{t('home.expense')}</span>
        </div>
        <div className="flex h-40 items-end gap-1 border-b border-line" role="img" aria-label={t('home.monthly_evolution')}>
          {s.months.map((m) => (
            <button key={m.month} onClick={() => onPickMonth(m.month)}
              title={`${monthName(locale, m.month)} · ${t('home.income')}: ${money(m.income)} · ${t('home.expense')}: ${money(m.expense)}`}
              className="group flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md hover:bg-black/[.04]">
              <span className="w-[42%] rounded-t-[4px] bg-income" style={{ height: `${(m.income / max) * 100}%` }} />
              <span className="w-[42%] rounded-t-[4px] bg-[#3d3a35]" style={{ height: `${(m.expense / max) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1">
          {s.months.map((m) => <span key={m.month} className="flex-1 text-center text-[10px] text-muted">{monthName(locale, m.month, 'narrow')}</span>)}
        </div>
        <table className="mt-3 w-full text-xs">
          <tbody>
            {s.months.filter((m) => m.income || m.expense).map((m) => (
              <tr key={m.month} className="border-t border-line/70">
                <td className="py-1.5 text-muted">{monthName(locale, m.month)}</td>
                <td className="tabular py-1.5 text-right text-income">{money0(m.income)}</td>
                <td className="tabular py-1.5 text-right">{money0(m.expense)}</td>
                <td className={`tabular py-1.5 text-right font-semibold ${m.income - m.expense < 0 ? 'text-danger' : ''}`}>{money0(m.income - m.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>{t('home.by_category')}</SectionTitle>
      <div className="card divide-y divide-line">
        {EXPENSE_CATEGORIES.map((c) => {
          const spent = s.byCat[c.key] || 0;
          const budget = (budgets[c.key] || 0) * 12;
          return (
            <div key={c.key} className="flex items-center gap-3 px-4 py-3.5">
              <CategoryIcon type="expense" category={c.key} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{t(`cat.${c.key}`)}</span>
                  <span className="tabular shrink-0 text-sm font-bold">{money0(spent)}</span>
                </div>
                <div className="mt-1.5"><ProgressBar value={spent} max={budget} color={c.color} /></div>
                <div className="mt-1 text-right text-[11px] text-muted tabular">{budget ? `${t('home.year_budget')}: ${money0(budget)}` : t('home.no_budget')}</div>
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>{t('home.income_sources')}</SectionTitle>
      <div className="card divide-y divide-line">
        {INCOME_CATEGORIES.map((c) => (
          <div key={c.key} className="flex items-center gap-3 px-4 py-3">
            <CategoryIcon type="income" category={c.key} size={32} />
            <span className="flex-1 text-sm font-semibold">{t(`cat.${c.key}`)}</span>
            <span className="tabular text-sm font-bold text-income">{money0(incomeByCat[c.key] || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
