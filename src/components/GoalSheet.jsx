import { useEffect, useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Sheet, Confirm } from './ui.jsx';
import { parseAmount } from '../lib/finance.js';

export function GoalSheet({ open, goal, onClose, notify }) {
  const { t } = useI18n();
  const { store, transactions, user } = useData();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(goal?.name || '');
    setTarget(goal?.target ? String(goal.target) : '');
    setError(null); setConfirmDelete(false);
  }, [open, goal]);

  async function save() {
    if (!name.trim()) return setError('form.err_concept');
    const tgt = target.trim() ? parseAmount(target) : null;
    const data = { name: name.trim(), target: Number.isFinite(tgt) && tgt > 0 ? tgt : null };
    try {
      if (goal) await store.update('goals', goal.id, data);
      else await store.add('goals', { ...data, createdBy: user.email });
      notify('common.saved'); onClose();
    } catch (e) { console.error(e); setError('common.error'); }
  }

  function askDelete() {
    if (transactions.some((tx) => tx.type === 'saving' && tx.category === goal.id)) { setError('sav.cannot_delete'); return; }
    setConfirmDelete(true);
  }

  async function doDelete() {
    try { await store.remove('goals', goal.id); notify('common.deleted'); onClose(); }
    catch (e) { console.error(e); setError('common.error'); }
  }

  return (
    <Sheet open={open} title={goal ? t('sav.edit_goal') : t('sav.add_goal')} onClose={onClose}
      footer={
        <div className="flex gap-2">
          {goal && <button className="btn btn-danger px-3.5" onClick={askDelete} aria-label={t('common.delete')}><LuTrash2 size={18} /></button>}
          <button className="btn btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary flex-[2]" onClick={save}>{t('common.save')}</button>
        </div>
      }>
      <label className="label" htmlFor="goal-name">{t('sav.goal_name')}</label>
      <input id="goal-name" className="field mb-4" placeholder={t('sav.goal_name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label" htmlFor="goal-target">{t('sav.goal_target')} <span className="font-normal">({t('common.optional')})</span></label>
      <input id="goal-target" inputMode="decimal" className="field tabular mb-2" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ''))} />
      {error && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{t(error)}</p>}
      <Confirm open={confirmDelete} text={t('sav.delete_confirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
        danger onCancel={() => setConfirmDelete(false)} onConfirm={doDelete} />
    </Sheet>
  );
}
