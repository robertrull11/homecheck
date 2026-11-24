import { useEffect, useMemo, useState } from 'react';
import { LuTriangleAlert, LuTrash2, LuRepeat, LuInfo } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Sheet, Segmented, Toggle, Confirm, CategoryIcon } from './ui.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, FREQUENCIES, categoryMeta } from '../lib/categories.js';
import { parseAmount, findDuplicates } from '../lib/finance.js';
import { parseDate, todayStr, formatShortDate } from '../lib/dates.js';

const TYPE_COLORS = { expense: 'var(--color-ink)', income: 'var(--color-income)', saving: 'var(--color-saving)' };

export function MovementSheet({ open, initial, defaults, onClose, notify }) {
  const { t, money, locale } = useI18n();
  const { store, user, transactions, templates, goals, memberName } = useData();
  const editing = !!initial?.id;

  const [type, setType] = useState('expense');
  const [amountText, setAmountText] = useState('');
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState('food');
  const [direction, setDirection] = useState('deposit');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [error, setError] = useState(null);
  const [dups, setDups] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const src = initial || {};
    const ty = src.type || defaults?.type || 'expense';
    setType(ty);
    setAmountText(src.amount != null ? String(Math.abs(src.amount)).replace('.', locale.startsWith('en') ? '.' : ',') : '');
    setConcept(src.concept || '');
    setCategory(src.category || defaults?.category || (ty === 'income' ? 'salary' : ty === 'saving' ? goals[0]?.id : 'food'));
    setDirection(src.amount < 0 || (!initial && defaults?.withdraw) ? 'withdraw' : 'deposit');
    setDate(src.date || defaults?.date || todayStr());
    setNotes(src.notes || '');
    setRepeat(!!defaults?.repeat && !initial);
    setFrequency('monthly');
    setError(null); setDups(null); setConfirmDelete(false); setBusy(false);
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeType(ty) {
    setType(ty); setDups(null); setError(null);
    setCategory(ty === 'income' ? 'salary' : ty === 'saving' ? goals[0]?.id : 'food');
  }

  const template = initial?.templateId ? templates.find((x) => x.id === initial.templateId) : null;

  const suggestions = useMemo(() => {
    const counts = new Map();
    for (const tx of transactions) if (tx.type === type && tx.category === category && tx.concept) counts.set(tx.concept, (counts.get(tx.concept) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
  }, [transactions, type, category]);

  async function save(skipDupCheck = false) {
    setError(null);
    const amount = parseAmount(amountText);
    if (!(amount > 0)) return setError('form.err_amount');
    if (!concept.trim()) return setError('form.err_concept');
    if (!date) return setError('form.err_date');
    if (type === 'saving' && !goals.some((g) => g.id === category)) return setError('form.err_goal');
    const { y, m, d } = parseDate(date);
    const signed = type === 'saving' && direction === 'withdraw' ? -amount : amount;
    const data = {
      type, category, concept: concept.trim(), amount: signed, date, year: y, month: m,
      notes: notes.trim(),
    };
    const willRepeat = repeat && !editing && (type !== 'saving' || direction === 'deposit');
    data.frequency = editing ? initial.frequency || 'one-off' : willRepeat ? frequency : 'one-off';
    if (!skipDupCheck && !willRepeat) {
      const found = findDuplicates({ ...data, id: initial?.id }, transactions);
      if (found.length) { setDups(found.slice(0, 3)); return; }
    }
    setBusy(true);
    try {
      if (editing) {
        await store.update('transactions', initial.id, { ...data, updatedBy: user.email });
      } else if (willRepeat) {
        await store.add('templates', {
          type, category, concept: data.concept, amount: Math.abs(amount), frequency, day: d, startDate: date,
          active: true, lastPeriod: null, notes: data.notes, createdBy: user.email,
        });
      } else {
        await store.add('transactions', { ...data, createdBy: user.email });
      }
      notify('common.saved');
      onClose();
    } catch (e) {
      console.error(e);
      setError('common.error');
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try { await store.remove('transactions', initial.id); notify('common.deleted'); onClose(); }
    catch (e) { console.error(e); setError('common.error'); setBusy(false); }
  }

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Sheet
      open={open}
      title={editing ? t('form.edit') : t('form.new')}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {editing && (
            <button className="btn btn-danger px-3.5" onClick={() => setConfirmDelete(true)} aria-label={t('common.delete')} disabled={busy}>
              <LuTrash2 size={18} />
            </button>
          )}
          <button className="btn btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary flex-[2]" onClick={() => save(false)} disabled={busy}>{t('common.save')}</button>
        </div>
      }
    >
      {!editing && (
        <Segmented
          className="mb-4"
          value={type}
          onChange={changeType}
          options={['expense', 'income', 'saving'].map((v) => ({ value: v, label: t(`type.${v}`), color: TYPE_COLORS[v] }))}
        />
      )}

      {template && (
        <p className="mb-4 flex gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-xs leading-relaxed text-brand">
          <LuRepeat size={16} className="mt-0.5 shrink-0" /> {t('form.from_template', { name: template.concept })}
        </p>
      )}

      {type === 'saving' && (
        <Segmented
          className="mb-4"
          value={direction}
          onChange={setDirection}
          options={[{ value: 'deposit', label: t('form.deposit') }, { value: 'withdraw', label: t('form.withdraw') }]}
        />
      )}

      <label className="label" htmlFor="amount">{t('form.amount')}</label>
      <div className="relative mb-4">
        <input
          id="amount" inputMode="decimal" autoComplete="off" placeholder="0,00"
          className="field tabular pr-10 !text-3xl font-bold" style={{ color: TYPE_COLORS[type] }}
          value={amountText} onChange={(e) => { setAmountText(e.target.value.replace(/[^\d.,]/g, '')); setDups(null); }}
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2 text-xl font-semibold text-muted">€</span>
      </div>

      <label className="label">{type === 'saving' ? t('form.goal') : t('form.category')}</label>
      {type === 'saving' ? (
        goals.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {goals.map((g) => (
              <button key={g.id} type="button" onClick={() => setCategory(g.id)}
                className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${category === g.id ? 'border-saving bg-saving text-white' : 'border-line bg-card'}`}>
                {g.name}
              </button>
            ))}
          </div>
        ) : <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">{t('form.err_goal')}</p>
      ) : (
        <div className="mb-4 grid grid-cols-1 gap-1.5">
          {categories.map((c) => {
            const active = category === c.key;
            return (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${active ? 'bg-card shadow-sm' : 'border-transparent bg-black/[.03]'}`}
                style={active ? { borderColor: categoryMeta(type, c.key).color } : undefined}>
                <CategoryIcon type={type} category={c.key} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t(`cat.${c.key}`)}</span>
                  {type === 'expense' && <span className="block truncate text-[11px] text-muted">{t(`catdesc.${c.key}`)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <label className="label" htmlFor="concept">{t('form.concept')}</label>
      <input id="concept" list="concept-suggestions" className="field mb-4" placeholder={t('form.concept_placeholder')}
        value={concept} onChange={(e) => setConcept(e.target.value)} autoComplete="off" />
      <datalist id="concept-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>

      <label className="label" htmlFor="date">{repeat ? t('rec.first_date') : t('form.date')}</label>
      <input id="date" type="date" className="field mb-4" value={date} onChange={(e) => { setDate(e.target.value); setDups(null); }} />

      {!editing && (type !== 'saving' || direction === 'deposit') ? (
        <div className="card mb-4 p-4">
          <Toggle checked={repeat} onChange={setRepeat} label={t('form.repeat')} hint={t('form.repeat_hint')} />
          {repeat && (
            <>
              <Segmented className="mt-3" value={frequency} onChange={setFrequency}
                options={FREQUENCIES.map((f) => ({ value: f, label: t(`freq.${f}`) }))} />
              {date < todayStr() && <p className="mt-2 flex gap-1.5 text-xs text-muted"><LuInfo size={14} className="mt-px shrink-0" />{t('rec.first_date_hint')}</p>}
            </>
          )}
        </div>
      ) : null}

      <label className="label" htmlFor="notes">{t('form.notes')} <span className="font-normal">({t('common.optional')})</span></label>
      <textarea id="notes" rows={2} className="field mb-2 resize-none" placeholder={t('form.notes_placeholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{t(error)}</p>}

      {dups && (
        <div className="mt-3 rounded-xl border border-warn/40 bg-warn-soft p-3" role="alert">
          <p className="flex items-center gap-2 font-semibold text-warn"><LuTriangleAlert size={18} /> {t('form.dup_title')}</p>
          <p className="mt-1 text-sm">{t('form.dup_text')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {dups.map((d) => (
              <li key={d.id} className="tabular">• {d.concept} — {money(Math.abs(d.amount))} — {formatShortDate(locale, d.date)} ({memberName(d.createdBy)})</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-ghost flex-1 bg-card" onClick={() => setDups(null)}>{t('common.cancel')}</button>
            <button className="btn flex-1 bg-warn text-white" onClick={() => save(true)} disabled={busy}>{t('form.dup_save')}</button>
          </div>
        </div>
      )}

      <Confirm open={confirmDelete} text={t('form.delete_confirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
        danger onCancel={() => setConfirmDelete(false)} onConfirm={doDelete} />
    </Sheet>
  );
}
