import { LuRepeat } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CategoryIcon } from './ui.jsx';
import { formatShortDate } from '../lib/dates.js';

export function MovementRow({ tx, onClick, showDate = false }) {
  const { t, money, locale } = useI18n();
  const { goals, memberName } = useData();
  const catLabel = tx.type === 'saving'
    ? goals.find((g) => g.id === tx.category)?.name || t('type.saving')
    : t(`cat.${tx.category}`);
  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : tx.amount >= 0 ? '→ ' : '← ';
  const color = tx.type === 'income' ? 'text-income' : tx.type === 'saving' ? 'text-saving' : 'text-ink';
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[.03]">
      <CategoryIcon type={tx.type} category={tx.category} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{tx.concept}</span>
          {tx.templateId && <LuRepeat size={13} className="shrink-0 text-muted" aria-label={t('mov.auto')} />}
        </span>
        <span className="block truncate text-xs text-muted">
          {showDate ? `${formatShortDate(locale, tx.date)} · ` : ''}{catLabel} · {memberName(tx.createdBy)}
        </span>
      </span>
      <span className={`tabular shrink-0 font-semibold ${color}`}>{sign}{money(Math.abs(tx.amount))}</span>
    </button>
  );
}
