import { useMemo } from 'react';
import { LuPiggyBank, LuPlus, LuPencil, LuCheck } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Empty, Ring, SectionTitle } from '../components/ui.jsx';
import { MovementRow } from '../components/MovementRow.jsx';
import { goalBalances, round2, monthFixedStatus } from '../lib/finance.js';
import { monthName, parseDate, todayStr, formatShortDate } from '../lib/dates.js';

export function SavingsScreen({ openGoal, openNew, openMovement, goTo }) {
  const { t, money, locale } = useI18n();
  const { transactions, templates, goals } = useData();
  const now = parseDate(todayStr());
  const balances = useMemo(() => goalBalances(transactions), [transactions]);
  const total = round2(Object.values(balances).reduce((a, b) => a + b, 0));
  const thisMonthTotal = round2(transactions.filter((x) => x.type === 'saving' && x.year === now.y && x.month === now.m).reduce((s, x) => s + x.amount, 0));
  const history = useMemo(() => transactions.filter((x) => x.type === 'saving').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [transactions]);
  const autoFor = (goalId) => templates.filter((x) => x.type === 'saving' && x.category === goalId && x.active !== false && x.frequency === 'monthly').reduce((a, x) => a + x.amount, 0);
  const fixed = useMemo(() => monthFixedStatus(templates, transactions, now.y, now.m), [templates, transactions]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = fixed.filter((f) => f.done).length;

  return (
    <div>
      <p className="px-1 text-sm leading-relaxed text-muted">{t('sav.intro')}</p>

      <div className="mt-4 flex items-end justify-between rounded-[22px] border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-5 py-4">
        <div>
          <p className="text-[13px] font-semibold text-[var(--accent-dark)]">{t('sav.total')}</p>
          <p className="font-display tabular mt-1 text-[34px] leading-none font-bold tracking-tight text-[var(--accent-dark)]">{money(total)}</p>
        </div>
        {thisMonthTotal !== 0 && <span className="tabular rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--accent-dark)]">{t('sav.this_month_badge', { amount: `${thisMonthTotal > 0 ? '+' : ''}${money(thisMonthTotal)}` })}</span>}
      </div>

      {goals.length === 0 ? (
        <div className="mt-4"><Empty icon={LuPiggyBank} text={t('sav.empty')} /></div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {goals.map((g) => {
            const bal = balances[g.id] || 0;
            const auto = autoFor(g.id);
            return (
              <div key={g.id} className="card relative flex min-w-0 flex-col items-center gap-2 p-3.5 text-center">
                <button className="absolute top-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-black/5" onClick={() => openGoal(g)} aria-label={t('common.edit')}><LuPencil size={15} /></button>
                {g.target > 0 ? <Ring pct={(bal / g.target) * 100} label={t('sav.ring_label', { name: g.name, pct: Math.round((bal / g.target) * 100) })} /> : <LuPiggyBank size={40} className="my-5 text-[var(--accent)]" />}
                <p className="w-full truncate text-sm font-bold">{g.name}</p>
                <p className="tabular text-xs text-muted">{g.target > 0 ? t('sav.of_target', { saved: money(bal), target: money(g.target) }) : money(bal)}</p>
                {auto > 0 && <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-dark)]">{t('sav.auto', { amount: money(auto) })}</span>}
                <div className="mt-1 flex w-full gap-1.5">
                  <button className="btn btn-primary h-9 flex-1 rounded-xl px-1 py-0 text-xs" onClick={() => openNew({ type: 'saving', category: g.id })}>{t('form.deposit')}</button>
                  <button className="btn btn-ghost h-9 flex-1 rounded-xl px-1 py-0 text-xs" onClick={() => openNew({ type: 'saving', category: g.id, withdraw: true })}>{t('form.withdraw')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[var(--accent)]/40 text-sm font-bold text-[var(--accent-dark)]" onClick={() => openGoal(null)}>
        <LuPlus size={18} /> {t('sav.add_goal')}
      </button>

      {fixed.length > 0 && (
        <>
          <SectionTitle right={<span className="text-xs text-muted">{t('sav.fixed_done', { done, total: fixed.length })}</span>}>{t('sav.fixed_month', { month: monthName(locale, now.m).toLowerCase() })}</SectionTitle>
          <div className="mb-2.5 h-2 rounded-full bg-tint"><div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${(done / fixed.length) * 100}%` }} /></div>
          <div className="card px-3.5">
            {fixed.slice(0, 8).map((f, i) => (
              <div key={f.tpl.id} className={`flex items-center gap-3 py-3 ${i < Math.min(fixed.length, 8) - 1 ? 'border-b border-hair' : ''}`}>
                <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-sm font-bold ${f.done ? 'bg-[var(--accent-soft)] text-[var(--accent-dark)]' : 'bg-warn-soft text-warn'}`}>{f.done ? <LuCheck size={14} /> : '·'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.tpl.concept}</p>
                  <p className="text-xs text-muted">{f.done ? t('sav.fixed_on', { date: formatShortDate(locale, f.tx.date) }) : t('sav.fixed_pending', { date: formatShortDate(locale, f.date) })}</p>
                </div>
                <span className={`tabular shrink-0 font-bold ${f.done ? (f.tpl.type === 'income' ? 'text-income' : '') : 'text-muted'}`}>{money(f.done ? Math.abs(f.tx.amount) : f.tpl.amount)}</span>
              </div>
            ))}
            <button className="block w-full py-3 text-center text-[13px] font-bold text-[var(--accent)]" onClick={() => goTo('recurring')}>{t('sav.see_fixed')}</button>
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle>{t('sav.history')}</SectionTitle>
          <div className="card divide-y divide-hair overflow-hidden">
            {history.map((tx) => <MovementRow key={tx.id} tx={tx} showDate onEdit={openMovement} />)}
          </div>
        </>
      )}
    </div>
  );
}
