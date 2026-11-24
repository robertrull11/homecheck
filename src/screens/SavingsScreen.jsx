import { useMemo } from 'react';
import { LuPiggyBank, LuPlus, LuPencil, LuArrowUpRight, LuArrowDownRight } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Empty, ProgressBar, SectionTitle } from '../components/ui.jsx';
import { MovementRow } from '../components/MovementRow.jsx';
import { goalBalances, round2 } from '../lib/finance.js';

export function SavingsScreen({ period, openGoal, openNew, openMovement }) {
  const { t, money } = useI18n();
  const { transactions, goals } = useData();
  const balances = useMemo(() => goalBalances(transactions), [transactions]);
  const total = round2(Object.values(balances).reduce((a, b) => a + b, 0));
  const history = useMemo(() => transactions.filter((x) => x.type === 'saving').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8), [transactions]);
  const thisMonth = (goalId) => round2(transactions.filter((x) => x.type === 'saving' && x.category === goalId && x.year === period.year && x.month === period.month).reduce((s, x) => s + x.amount, 0));

  return (
    <div>
      <p className="px-1 text-sm leading-relaxed text-muted">{t('sav.intro')}</p>

      <div className="card mt-4 px-5 py-4">
        <p className="text-sm font-medium text-muted">{t('sav.total')}</p>
        <p className="tabular mt-1 text-3xl font-extrabold text-saving">{money(total)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="btn btn-ghost flex-1 bg-card" onClick={() => openGoal(null)}><LuPlus size={18} /> {t('sav.add_goal')}</button>
      </div>

      {goals.length === 0 ? (
        <div className="mt-4"><Empty icon={LuPiggyBank} text={t('sav.empty')} /></div>
      ) : (
        <div className="mt-4 space-y-3">
          {goals.map((g) => {
            const bal = balances[g.id] || 0;
            const month = thisMonth(g.id);
            return (
              <div key={g.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{g.name}</p>
                    <p className="text-xs text-muted">
                      {g.target ? t('sav.target', { amount: money(g.target) }) : ''}{g.target && month ? ' · ' : ''}{month ? t('sav.this_month', { amount: money(month) }) : ''}
                    </p>
                  </div>
                  <button className="-mt-1 -mr-1 rounded-full p-2 text-muted hover:bg-black/5" onClick={() => openGoal(g)} aria-label={t('common.edit')}><LuPencil size={16} /></button>
                </div>
                <p className="tabular mt-2 text-2xl font-extrabold">{money(bal)}</p>
                {g.target > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1"><ProgressBar value={bal} max={g.target} color="var(--color-saving)" /></div>
                    <span className="tabular w-10 text-right text-xs font-semibold text-muted">{Math.min(100, Math.round((bal / g.target) * 100))}%</span>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button className="btn flex-1 bg-saving/10 py-2 text-sm text-saving" onClick={() => openNew({ type: 'saving', category: g.id })}>
                    <LuArrowUpRight size={16} /> {t('form.deposit')}
                  </button>
                  <button className="btn btn-ghost flex-1 py-2 text-sm" onClick={() => openNew({ type: 'saving', category: g.id, withdraw: true })}>
                    <LuArrowDownRight size={16} /> {t('form.withdraw')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle>{t('sav.history')}</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden">
            {history.map((tx) => <MovementRow key={tx.id} tx={tx} showDate onClick={() => openMovement(tx)} />)}
          </div>
        </>
      )}
    </div>
  );
}
