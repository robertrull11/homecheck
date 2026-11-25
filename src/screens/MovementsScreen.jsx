import { useMemo, useState, useEffect } from 'react';
import { LuSearch, LuList } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { MovementRow } from '../components/MovementRow.jsx';
import { Empty, Avatar } from '../components/ui.jsx';
import { formatDayHeader, todayStr } from '../lib/dates.js';
import { round2 } from '../lib/finance.js';
import { members } from '../config.js';

const net = (x) => (x.type === 'income' ? x.amount : -x.amount);

export function MovementsScreen({ period, filter, openMovement, requestDelete }) {
  const { t, money, locale } = useI18n();
  const { transactions, goals, expenseCats, incomeCats, kind, memberName, memberStyle } = useData();
  const [type, setType] = useState(filter?.type || 'all');
  const [category, setCategory] = useState(filter?.category || 'all');
  const [who, setWho] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => { setType(filter?.type || 'all'); setCategory(filter?.category || 'all'); }, [filter]);

  const people = useMemo(() => {
    const emails = new Set(transactions.map((x) => x.createdBy).filter(Boolean));
    members.forEach((m) => emails.add(m.email.toLowerCase()));
    return [...emails];
  }, [transactions]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter((x) => x.year === period.year && (period.mode === 'year' || x.month === period.month))
      .filter((x) => type === 'all' || x.type === type)
      .filter((x) => category === 'all' || x.category === category)
      .filter((x) => who === 'all' || (x.createdBy || '').toLowerCase() === who)
      .filter((x) => !q || `${x.concept} ${x.notes || ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [transactions, period, type, category, who, query]);

  const groups = useMemo(() => {
    const out = [];
    for (const tx of list) {
      const last = out[out.length - 1];
      if (last && last.date === tx.date) { last.items.push(tx); last.total += net(tx); }
      else out.push({ date: tx.date, items: [tx], total: net(tx) });
    }
    return out;
  }, [list]);

  const expense = round2(list.filter((x) => x.type === 'expense').reduce((a, x) => a + x.amount, 0));
  const income = round2(list.filter((x) => x.type === 'income').reduce((a, x) => a + x.amount, 0));
  const catOptions = type === 'income' ? incomeCats : type === 'expense' ? expenseCats : type === 'saving' ? goals.map((g) => ({ key: g.id, label: g.name })) : null;
  const dayLabel = (d) => (d === todayStr() ? `${t('form.today')} · ${formatDayHeader(locale, d)}` : formatDayHeader(locale, d));

  return (
    <div>
      <div className="relative">
        <LuSearch className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" size={18} />
        <input type="search" aria-label={t('common.search')} className="field pl-10" placeholder={t('mov.search_placeholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
        {['all', 'expense', 'income', 'saving'].map((v) => (
          <button key={v} onClick={() => { setType(v); setCategory('all'); }} className={`chip ${type === v ? 'chip-on' : ''}`}>
            {v === 'all' ? t('common.all') : t(`type.${v === 'income' ? 'incomes' : v === 'expense' ? 'expenses' : 'savings'}`)}
          </button>
        ))}
        {kind === 'home' && people.length > 1 && people.map((e) => (
          <button key={e} onClick={() => setWho(who === e ? 'all' : e)} className={`chip ${who === e ? 'chip-dark' : ''}`} aria-pressed={who === e}>
            <Avatar name={memberName(e)} style={memberStyle(e)} size={18} />{memberName(e)}
          </button>
        ))}
      </div>

      {catOptions && (
        <select className="field mt-2 py-2" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('form.category')}>
          <option value="all">{t('mov.all_categories')}</option>
          {catOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="card min-w-0 px-2.5 py-2"><p className="text-[11px] text-muted">{t('mov.count_label')}</p><p className="tabular font-bold">{list.length}</p></div>
        <div className="card min-w-0 px-2.5 py-2"><p className="text-[11px] text-muted">{t('home.expense')}</p><p className="tabular truncate font-bold">−{money(expense)}</p></div>
        <div className="card min-w-0 px-2.5 py-2"><p className="text-[11px] text-muted">{t('home.income')}</p><p className="tabular truncate font-bold text-income">+{money(income)}</p></div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-4"><Empty icon={LuList} text={t('mov.empty')} /></div>
      ) : groups.map((g, gi) => (
        <div key={g.date} className="mt-4">
          <div className="mb-1.5 flex justify-between px-1 text-xs font-bold text-muted">
            <span>{dayLabel(g.date)}</span><span className="tabular">{g.total >= 0 ? '+' : '−'}{money(Math.abs(g.total))}</span>
          </div>
          <div className="card divide-y divide-hair overflow-hidden">
            {g.items.map((tx) => <MovementRow key={tx.id} tx={tx} onEdit={openMovement} onDelete={tx.linkedFrom ? undefined : requestDelete} />)}
          </div>
          {gi === 0 && <p className="mt-1.5 px-1 text-[11px] text-muted">{t('mov.swipe_hint')}</p>}
        </div>
      ))}
    </div>
  );
}
