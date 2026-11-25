import { useEffect, useMemo, useState } from 'react';
import { LuTriangleAlert, LuTrash2, LuRepeat, LuInfo, LuPlus, LuMinus, LuLock } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Sheet, Segmented, Toggle, Confirm, CatIcon } from './ui.jsx';
import { FREQUENCIES } from '../lib/categories.js';
import { parseAmount, findDuplicates } from '../lib/finance.js';
import { parseDate, todayStr, formatShortDate } from '../lib/dates.js';
import { saveMovement, deleteMovement } from '../lib/actions.js';

const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return todayStr(d); };

export function MovementSheet({ open, initial, defaults, onClose, notify }) {
  const { t, money, locale } = useI18n();
  const { space, user, kind, transactions, templates, goals, expenseCats, incomeCats, memberName, contribConcept } = useData();
  const editing = !!initial?.id;
  const linked = !!initial?.linkedFrom;

  const [type, setType] = useState('expense');
  const [amountText, setAmountText] = useState('');
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState('');
  const [direction, setDirection] = useState('deposit');
  const [date, setDate] = useState(todayStr());
  const [otherDate, setOtherDate] = useState(false);
  const [notes, setNotes] = useState('');
  const [more, setMore] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [error, setError] = useState(null);
  const [dups, setDups] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const firstCat = (ty) => (ty === 'income' ? incomeCats[0]?.key : ty === 'saving' ? goals[0]?.id : expenseCats.find((c) => !c.system)?.key || expenseCats[0]?.key);

  useEffect(() => {
    if (!open) return;
    const src = initial || {};
    const ty = src.type || defaults?.type || 'expense';
    const d = src.date || defaults?.date || todayStr();
    setType(ty);
    setAmountText(src.amount != null ? String(Math.abs(src.amount)).replace('.', locale.startsWith('en') ? '.' : ',') : '');
    setConcept(src.concept || '');
    setCategory(src.category || defaults?.category || firstCat(ty));
    setDirection(src.amount < 0 || (!initial && defaults?.withdraw) ? 'withdraw' : 'deposit');
    setDate(d);
    setOtherDate(d !== todayStr() && d !== yesterday());
    setNotes(src.notes || '');
    setRepeat(!!defaults?.repeat && !initial);
    setMore(!!defaults?.repeat || !!src.notes);
    setFrequency('monthly');
    setError(null); setDups(null); setConfirmDelete(false); setBusy(false);
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeType(ty) { setType(ty); setDups(null); setError(null); setCategory(firstCat(ty)); }

  const template = initial?.templateId ? templates.find((x) => x.id === initial.templateId) : null;
  const cats = type === 'income' ? incomeCats : type === 'saving' ? goals.map((g) => ({ key: g.id, label: g.name, color: 'var(--accent)' })) : expenseCats;

  const suggestions = useMemo(() => {
    const counts = new Map();
    for (const tx of transactions) if (tx.type === type && tx.category === category && tx.concept) counts.set(tx.concept, (counts.get(tx.concept) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  }, [transactions, type, category]);

  const amountNum = parseAmount(amountText);
  const willRepeat = repeat && !editing && (type !== 'saving' || direction === 'deposit');

  async function save(skipDupCheck = false) {
    setError(null);
    if (!(amountNum > 0)) return setError('form.err_amount');
    if (!concept.trim()) return setError('form.err_concept');
    if (!date) return setError('form.err_date');
    if (type === 'saving' && !goals.some((g) => g.id === category)) return setError('form.err_goal');
    const { y, m, d } = parseDate(date);
    const signed = type === 'saving' && direction === 'withdraw' ? -amountNum : amountNum;
    const data = { type, category, concept: concept.trim(), amount: signed, date, year: y, month: m, notes: notes.trim() };
    data.frequency = editing ? initial.frequency || 'one-off' : willRepeat ? frequency : 'one-off';
    if (!skipDupCheck && !willRepeat) {
      const found = findDuplicates({ ...data, id: initial?.id }, transactions);
      if (found.length) { setDups(found.slice(0, 3)); return; }
    }
    setBusy(true);
    try {
      if (willRepeat) {
        await space.add('templates', {
          type, category, concept: data.concept, amount: amountNum, frequency, day: d, startDate: date,
          active: true, lastPeriod: null, notes: data.notes, createdBy: user.email,
        });
      } else {
        await saveMovement({ space, user, before: editing ? initial : null, data, contribConcept: contribConcept() });
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
    try { await deleteMovement({ space, user, tx: initial }); notify('common.deleted'); onClose(); }
    catch (e) { console.error(e); setError('common.error'); setBusy(false); }
  }

  const saveLabel = `${t(`form.save_${type}`)}${amountNum > 0 ? ` · ${money(amountNum)}` : ''}`;
  const pickDate = (v) => { setDups(null); if (v === 'today') { setDate(todayStr()); setOtherDate(false); } else if (v === 'yesterday') { setDate(yesterday()); setOtherDate(false); } else setOtherDate(true); };

  return (
    <Sheet
      open={open}
      title={editing ? t('form.edit') : t('form.new')}
      onClose={onClose}
      footer={linked ? null : (
        <div className="flex gap-2">
          {editing && (
            <button className="btn btn-danger px-3.5" onClick={() => setConfirmDelete(true)} aria-label={t('common.delete')} disabled={busy}>
              <LuTrash2 size={18} />
            </button>
          )}
          <button className="btn btn-primary h-14 flex-1 rounded-2xl text-base shadow-[0_8px_18px_var(--accent-glow)]" onClick={() => save(false)} disabled={busy}>
            <span className="tabular">{saveLabel}</span>
          </button>
        </div>
      )}
    >
      {linked && (
        <p className="mb-4 flex gap-2 rounded-2xl bg-[var(--accent-soft)] px-3 py-3 text-sm leading-relaxed text-[var(--accent-dark)]">
          <LuLock size={18} className="mt-0.5 shrink-0" /> {t('contrib.readonly', { name: memberName(initial.createdBy) })}
        </p>
      )}

      <fieldset disabled={linked} className="m-0 min-w-0 border-0 p-0">
        {!editing && (
          <Segmented className="mb-3" value={type} onChange={changeType}
            options={['expense', 'income', 'saving'].map((v) => ({ value: v, label: t(`type.${v}`) }))} />
        )}

        {template && (
          <p className="mb-3 flex gap-2 rounded-2xl bg-[var(--accent-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--accent-dark)]">
            <LuRepeat size={16} className="mt-0.5 shrink-0" /> {t('form.from_template', { name: template.concept })}
          </p>
        )}

        {type === 'saving' && (
          <Segmented className="mb-3" size="sm" value={direction} onChange={setDirection}
            options={[{ value: 'deposit', label: t('form.deposit'), icon: <LuPlus size={14} /> }, { value: 'withdraw', label: t('form.withdraw'), icon: <LuMinus size={14} /> }]} />
        )}

        <label className="sr-only" htmlFor="amount">{t('form.amount')}</label>
        <div className="mb-3 flex items-baseline justify-center gap-1.5">
          <input
            id="amount" inputMode="decimal" autoComplete="off" placeholder="0,00"
            style={{ width: `${Math.max(4, amountText.length + 0.5)}ch` }}
            className="font-display tabular bg-transparent text-center text-[48px] font-bold tracking-tight outline-none placeholder:text-[#b5c6c8]"
            value={amountText} onChange={(e) => { setAmountText(e.target.value.replace(/[^\d.,]/g, '')); setDups(null); }}
          />
          <span className="font-display text-3xl font-semibold text-muted">€</span>
        </div>

        <p className="label">{type === 'saving' ? t('form.goal') : t('form.category')}</p>
        {cats.length ? (
          <div className="mb-4 grid grid-cols-4 gap-1.5">
            {cats.map((c) => {
              const active = category === c.key;
              return (
                <button key={c.key} type="button" onClick={() => setCategory(c.key)} aria-pressed={active}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 px-1 py-2 text-[11px] font-semibold transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-dark)]' : 'border-transparent bg-white'}`}>
                  <CatIcon label={c.label} color={c.color} size={34} />
                  <span className="w-full truncate text-center">{c.label}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="mb-4 rounded-2xl bg-warn-soft px-3 py-2.5 text-sm text-warn-ink">{t('form.err_goal')}</p>}

        <label className="label" htmlFor="concept">{t('form.concept')}</label>
        <input id="concept" className="field mb-2" placeholder={t('form.concept_placeholder')} value={concept} onChange={(e) => setConcept(e.target.value)} autoComplete="off" />
        {suggestions.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {suggestions.map((s) => <button key={s} type="button" className={`chip ${concept === s ? 'chip-on' : ''}`} onClick={() => setConcept(s)}>{s}</button>)}
          </div>
        )}

        <p className="label">{willRepeat ? t('rec.first_date') : t('form.date')}</p>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button type="button" className={`chip ${!otherDate && date === todayStr() ? 'chip-dark' : ''}`} onClick={() => pickDate('today')}>{t('form.today')}</button>
          <button type="button" className={`chip ${!otherDate && date === yesterday() ? 'chip-dark' : ''}`} onClick={() => pickDate('yesterday')}>{t('form.yesterday')}</button>
          <button type="button" className={`chip ${otherDate ? 'chip-dark' : ''}`} onClick={() => pickDate('other')}>{otherDate ? formatShortDate(locale, date) : t('form.other_date')}</button>
        </div>
        {otherDate && <input aria-label={t('form.date')} type="date" className="field mb-3" value={date} onChange={(e) => { setDate(e.target.value); setDups(null); }} />}

        {!more ? (
          <button type="button" className="chip mb-2" onClick={() => setMore(true)}><LuPlus size={14} /> {t('form.more')}</button>
        ) : (
          <div className="mb-2 space-y-3">
            {!editing && (type !== 'saving' || direction === 'deposit') && (
              <div className="card p-4">
                <Toggle checked={repeat} onChange={setRepeat} label={t('form.repeat')} hint={t('form.repeat_hint')} />
                {repeat && (
                  <>
                    <Segmented className="mt-3" size="sm" value={frequency} onChange={setFrequency} options={FREQUENCIES.map((f) => ({ value: f, label: t(`freq.${f}`) }))} />
                    {date < todayStr() && <p className="mt-2 flex gap-1.5 text-xs text-muted"><LuInfo size={14} className="mt-px shrink-0" />{t('rec.first_date_hint')}</p>}
                  </>
                )}
              </div>
            )}
            <div>
              <label className="label" htmlFor="notes">{t('form.notes')} <span className="font-normal">({t('common.optional')})</span></label>
              <textarea id="notes" rows={2} className="field resize-none" placeholder={t('form.notes_placeholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}
        {kind === 'personal' && type === 'expense' && expenseCats.find((c) => c.key === category)?.system && (
          <p className="mt-2 flex gap-2 text-xs leading-relaxed text-muted"><LuInfo size={14} className="mt-0.5 shrink-0" />{t('contrib.hint')}</p>
        )}
      </fieldset>

      {error && <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{t(error)}</p>}

      {dups && (
        <div className="mt-3 rounded-2xl border border-warn-line bg-warn-soft p-3" role="alert">
          <p className="flex items-center gap-2 font-semibold text-warn-ink"><LuTriangleAlert size={18} /> {t('form.dup_title')}</p>
          <p className="mt-1 text-sm">{t('form.dup_text')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {dups.map((d) => (
              <li key={d.id} className="tabular">• {d.concept} — {money(Math.abs(d.amount))} — {formatShortDate(locale, d.date)} ({memberName(d.createdBy)})</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => setDups(null)}>{t('common.cancel')}</button>
            <button className="btn flex-1 bg-warn text-white" onClick={() => save(true)} disabled={busy}>{t('form.dup_save')}</button>
          </div>
        </div>
      )}

      <Confirm open={confirmDelete} text={t('form.delete_confirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
        danger onCancel={() => setConfirmDelete(false)} onConfirm={doDelete} />
    </Sheet>
  );
}
