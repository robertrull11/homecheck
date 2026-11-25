import { useEffect, useState } from 'react';
import { LuTrash2, LuInfo } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Sheet, Segmented, Toggle, Confirm } from './ui.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, FREQUENCIES } from '../lib/categories.js';
import { parseAmount } from '../lib/finance.js';
import { resumePatch } from '../screens/RecurringScreen.jsx';

export function TemplateSheet({ open, template, onClose, notify }) {
  const { t, locale } = useI18n();
  const { store, goals } = useData();
  const [concept, setConcept] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [day, setDay] = useState(1);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    setConcept(template.concept);
    setAmountText(String(template.amount).replace('.', locale.startsWith('en') ? '.' : ','));
    setCategory(template.category);
    setFrequency(template.frequency);
    setDay(template.day || 1);
    setActive(template.active !== false);
    setNotes(template.notes || '');
    setError(null); setConfirmDelete(false);
  }, [open, template]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!template) return null;

  async function save() {
    const amount = parseAmount(amountText);
    if (!(amount > 0)) return setError('form.err_amount');
    if (!concept.trim()) return setError('form.err_concept');
    try {
      const resuming = active && template.active === false;
      await store.update('templates', template.id, {
        concept: concept.trim(), amount, category, frequency, day: Math.min(31, Math.max(1, Number(day) || 1)), active, notes: notes.trim(),
        ...(resuming ? resumePatch({ ...template, frequency, day: Math.min(31, Math.max(1, Number(day) || 1)) }) : {}),
      });
      notify('common.saved'); onClose();
    } catch (e) { console.error(e); setError('common.error'); }
  }

  async function doDelete() {
    try { await store.remove('templates', template.id); notify('common.deleted'); onClose(); }
    catch (e) { console.error(e); setError('common.error'); }
  }

  const cats = template.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Sheet open={open} title={t('rec.edit')} onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-danger px-3.5" onClick={() => setConfirmDelete(true)} aria-label={t('common.delete')}><LuTrash2 size={18} /></button>
          <button className="btn btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary flex-[2]" onClick={save}>{t('common.save')}</button>
        </div>
      }>
      <p className="mb-4 flex gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-xs leading-relaxed text-brand">
        <LuInfo size={16} className="mt-0.5 shrink-0" /> {t('rec.change_future')}
      </p>

      <label className="label" htmlFor="tpl-concept">{t('form.concept')}</label>
      <input id="tpl-concept" className="field mb-4" value={concept} onChange={(e) => setConcept(e.target.value)} />

      <label className="label" htmlFor="tpl-amount">{t('form.amount')}</label>
      <div className="relative mb-4">
        <input id="tpl-amount" inputMode="decimal" className="field tabular pr-10 text-xl font-bold" value={amountText}
          onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ''))} />
        <span className="absolute top-1/2 right-4 -translate-y-1/2 font-semibold text-muted">€</span>
      </div>

      <label className="label" htmlFor="tpl-cat">{template.type === 'saving' ? t('form.goal') : t('form.category')}</label>
      <select id="tpl-cat" className="field mb-4" value={category} onChange={(e) => setCategory(e.target.value)}>
        {template.type === 'saving'
          ? goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)
          : cats.map((c) => <option key={c.key} value={c.key}>{t(`cat.${c.key}`)}</option>)}
      </select>

      <label className="label">{t('form.frequency')}</label>
      <Segmented className="mb-4" value={frequency} onChange={setFrequency} options={FREQUENCIES.map((f) => ({ value: f, label: t(`freq.${f}`) }))} />

      <label className="label" htmlFor="tpl-day">{t('rec.day')}</label>
      <input id="tpl-day" type="number" min="1" max="31" inputMode="numeric" className="field mb-4 w-28" value={day} onChange={(e) => setDay(e.target.value)} />

      <div className="card mb-4 p-4">
        <Toggle checked={!active} onChange={(v) => setActive(!v)} label={t('rec.paused')} />
      </div>

      <label className="label" htmlFor="tpl-notes">{t('form.notes')}</label>
      <textarea id="tpl-notes" rows={2} className="field mb-2 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{t(error)}</p>}

      <Confirm open={confirmDelete} text={t('rec.delete_confirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
        danger onCancel={() => setConfirmDelete(false)} onConfirm={doDelete} />
    </Sheet>
  );
}
