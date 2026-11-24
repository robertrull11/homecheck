import { useMemo, useState, useEffect } from 'react';
import { LuSearch, LuList } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { MovementRow } from '../components/MovementRow.jsx';
import { Empty } from '../components/ui.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories.js';
import { formatDayHeader } from '../lib/dates.js';
import { round2 } from '../lib/finance.js';

export function MovementsScreen({ period, filter, openMovement }) {
  const { t, money, locale } = useI18n();
  const { transactions, goals } = useData();
  const [type, setType] = useState(filter?.type || 'all');
  const [category, setCategory] = useState(filter?.category || 'all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setType(filter?.type || 'all');
    setCategory(filter?.category || 'all');
  }, [filter]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter((x) => x.year === period.year && (period.mode === 'year' || x.month === period.month))
      .filter((x) => type === 'all' || x.type === type)
      .filter((x) => category === 'all' || x.category === category)
      .filter((x) => !q || `${x.concept} ${x.notes || ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [transactions, period, type, category, query]);

  const groups = useMemo(() => {
    const out = [];
    for (const tx of list) {
      const last = out[out.length - 1];
      if (last && last.date === tx.date) last.items.push(tx);
      else out.push({ date: tx.date, items: [tx] });
    }
    return out;
  }, [list]);

  const total = round2(list.reduce((sum, x) => sum + (x.type === 'expense' ? -x.amount : x.type === 'income' ? x.amount : -x.amount), 0));
  const catOptions = type === 'income' ? INCOME_CATEGORIES : type === 'expense' ? EXPENSE_CATEGORIES : null;

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['all', 'expense', 'income', 'saving'].map((v) => (
          <button key={v} onClick={() => { setType(v); setCategory('all'); }}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${type === v ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}>
            {v === 'all' ? t('common.all') : t(`type.${v === 'income' ? 'incomes' : v === 'expense' ? 'expenses' : 'savings'}`)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <LuSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={17} />
          <input type="search" className="field py-2 pl-9" placeholder={t('mov.search_placeholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {(catOptions || type === 'saving') && (
          <select className="field w-auto max-w-[45%] py-2" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('form.category')}>
            <option value="all">{t('mov.all_categories')}</option>
            {type === 'saving'
              ? goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)
              : catOptions.map((c) => <option key={c.key} value={c.key}>{t(`cat.${c.key}`)}</option>)}
          </select>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted">
        <span>{t('mov.count', { count: list.length })}</span>
        <span className="tabular">{t('mov.total')}: <b className={total < 0 ? 'text-ink' : 'text-income'}>{money(total)}</b></span>
      </div>

      {groups.length === 0 ? (
        <div className="mt-3"><Empty icon={LuList} text={t('mov.empty')} /></div>
      ) : groups.map((g) => (
        <div key={g.date} className="mt-3">
          <p className="mb-1.5 px-1 text-xs font-semibold text-muted">{formatDayHeader(locale, g.date)}</p>
          <div className="card divide-y divide-line overflow-hidden">
            {g.items.map((tx) => <MovementRow key={tx.id} tx={tx} onClick={() => openMovement(tx)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
