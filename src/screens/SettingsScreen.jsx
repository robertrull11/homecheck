import { useEffect, useState } from 'react';
import { LuDownload, LuLogOut, LuSmartphone, LuInfo, LuUndo2, LuPlus, LuTrash2, LuLock, LuShieldCheck } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CatIcon, SectionTitle, Confirm } from '../components/ui.jsx';
import { LanguageSelect } from '../components/LanguageSelect.jsx';
import { PALETTE } from '../lib/categories.js';
import { parseAmount, round2 } from '../lib/finance.js';
import { exportCsv } from '../lib/exportCsv.js';
import { getAutoLock, setAutoLock, AUTOLOCK_OPTIONS } from '../lib/autolock.js';
import { members } from '../config.js';

/* global __APP_VERSION__ */
const fmtNum = (n, locale) => String(n ?? '').replace('.', locale.startsWith('en') ? '.' : ',');

export function SettingsScreen({ period, notify, store }) {
  const { t, lang, locale } = useI18n();
  const { space, kind, user, transactions, templates, goals, memberName, categoryOf, expenseCats } = useData();
  const [lock, setLock] = useState(getAutoLock());
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const doExport = (year) => exportCsv({ transactions, t, lang, memberName, year, categoryOf });
  const admin = members[0] ? members[0].name : '';
  const isAdmin = members[0] && members[0].email.toLowerCase() === user.email;

  async function wipe() {
    try { await space.wipe(); notify('set.wiped'); }
    catch (e) { console.error(e); notify('common.error'); }
    setWipeOpen(false); setWipeText('');
  }

  return (
    <div>
      {kind === 'personal' && (
        <div className="flex gap-2.5 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--accent-dark)]">
          <LuLock size={18} className="mt-0.5 shrink-0" />
          <span>{t(isAdmin ? 'set.private_admin' : 'set.private_member', { admin })}</span>
        </div>
      )}

      {kind === 'home' ? <HomeBudgets expenseCats={expenseCats} space={space} notify={notify} t={t} locale={locale} />
        : <PersonalCategories expenseCats={expenseCats} space={space} notify={notify} t={t} locale={locale} transactions={transactions} templates={templates} />}

      <SectionTitle>{t('set.language')}</SectionTitle>
      <div className="card flex items-center justify-between p-4">
        <span className="text-sm font-semibold">{t('set.language')}</span>
        <LanguageSelect />
      </div>

      <SectionTitle>{t('set.security')}</SectionTitle>
      <div className="card p-4">
        <label className="flex items-center justify-between gap-3">
          <span className="flex items-start gap-2 text-sm"><LuShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" /><span><b className="block font-semibold">{t('set.autolock')}</b><span className="text-xs text-muted">{t('set.autolock_hint')}</span></span></span>
          <select className="field w-auto py-2" value={lock} onChange={(e) => { const v = Number(e.target.value); setLock(v); setAutoLock(v); notify('common.saved'); }}>
            {AUTOLOCK_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? t('set.autolock_never') : m < 60 ? t('set.minutes', { n: m }) : t('set.hours', { n: m / 60 })}</option>)}
          </select>
        </label>
      </div>

      <SectionTitle>{t('set.export')}</SectionTitle>
      <div className="card p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted">{t(kind === 'home' ? 'set.export_hint' : 'set.export_hint_me')}</p>
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1 py-2 text-sm" onClick={() => doExport(period.year)}><LuDownload size={16} /> {t('set.export_year', { year: period.year })}</button>
          <button className="btn btn-ghost flex-1 py-2 text-sm" onClick={() => doExport(null)}><LuDownload size={16} /> {t('set.export_all')}</button>
        </div>
      </div>

      <SectionTitle>{t('set.install')}</SectionTitle>
      <div className="card space-y-2 p-4 text-sm leading-relaxed">
        <p className="flex gap-2"><LuSmartphone size={18} className="mt-0.5 shrink-0 text-muted" /> {t('set.install_ios')}</p>
        <p className="flex gap-2"><LuSmartphone size={18} className="mt-0.5 shrink-0 text-muted" /> {t('set.install_android')}</p>
      </div>

      {store.mode === 'demo' && (
        <>
          <SectionTitle>{t('set.demo_mode')}</SectionTitle>
          <div className="card p-4">
            <p className="flex gap-2 text-sm leading-relaxed"><LuInfo size={18} className="mt-0.5 shrink-0 text-warn" /> {t('set.demo_text')}</p>
            <button className="btn btn-ghost mt-3 w-full py-2 text-sm" onClick={() => setConfirmReset(true)}><LuUndo2 size={16} /> {t('set.reset_demo')}</button>
          </div>
        </>
      )}

      <SectionTitle>{t('set.account')}</SectionTitle>
      <div className="card p-4">
        <p className="text-sm text-muted">{t('set.signed_in_as', { email: user.email })}</p>
        <button className="btn btn-ghost mt-3 w-full py-2" onClick={() => store.signOut()}><LuLogOut size={16} /> {t('set.sign_out')}</button>
      </div>

      <SectionTitle>{t('set.danger')}</SectionTitle>
      <div className="card border-danger/30 p-4">
        <p className="text-xs leading-relaxed text-muted">{t(kind === 'home' ? 'set.wipe_hint_home' : 'set.wipe_hint_me')}</p>
        <button className="btn btn-danger mt-3 w-full py-2" onClick={() => setWipeOpen(true)}><LuTrash2 size={16} /> {t(kind === 'home' ? 'set.wipe_home' : 'set.wipe_me')}</button>
      </div>

      <p className="mt-6 mb-2 text-center text-[11px] text-muted">{t('set.version', { version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev' })}</p>

      <Confirm open={wipeOpen} danger text={t('set.wipe_confirm', { word: t('set.wipe_word') })} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
        confirmDisabled={wipeText.trim().toUpperCase() !== t('set.wipe_word')} onCancel={() => { setWipeOpen(false); setWipeText(''); }} onConfirm={wipe}>
        <input aria-label={t('set.wipe_word')} className="field mt-3" value={wipeText} onChange={(e) => setWipeText(e.target.value)} placeholder={t('set.wipe_word')} autoCapitalize="characters" />
      </Confirm>
      <Confirm open={confirmReset} text={t('set.reset_demo_confirm')} confirmLabel={t('set.reset_demo')} cancelLabel={t('common.cancel')} danger
        onCancel={() => setConfirmReset(false)} onConfirm={() => { store.resetDemo(); setConfirmReset(false); notify('common.saved'); }} />
    </div>
  );
}

function HomeBudgets({ expenseCats, space, notify, t, locale }) {
  const { money } = useI18n();
  const [draft, setDraft] = useState({});
  useEffect(() => { setDraft(Object.fromEntries(expenseCats.map((c) => [c.key, fmtNum(c.budget, locale)]))); }, [expenseCats.map((c) => c.budget).join(), locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v === '' ? 0 : parseAmount(v)]));
  const dirty = expenseCats.some((c) => round2(parsed[c.key] || 0) !== round2(c.budget));
  const valid = Object.values(parsed).every((n) => Number.isFinite(n) && n >= 0);
  const total = round2(Object.values(parsed).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0));
  async function save() {
    try { await space.saveSettings({ budgets: parsed }); notify('common.saved'); } catch (e) { console.error(e); notify('common.error'); }
  }
  return (
    <>
      <SectionTitle>{t('set.budgets')}</SectionTitle>
      <div className="card p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted">{t('set.budgets_hint')}</p>
        <div className="space-y-2.5">
          {expenseCats.map((c) => (
            <label key={c.key} className="flex items-center gap-3">
              <CatIcon label={c.label} color={c.color} size={32} />
              <span className="min-w-0 flex-1 text-sm leading-tight font-semibold">{c.label}</span>
              <span className="relative w-28">
                <input inputMode="decimal" className="field tabular py-2 pr-7 text-right" value={draft[c.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value.replace(/[^\d.,]/g, '') })} aria-label={c.label} />
                <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted">€</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">{t('set.budget_total')}: <b className="tabular text-ink">{money(total)}</b></span>
          <button className="btn btn-primary py-2" disabled={!dirty || !valid} onClick={save}>{t('common.save')}</button>
        </div>
      </div>
    </>
  );
}

function PersonalCategories({ expenseCats, space, notify, t, locale, transactions, templates }) {
  const { money } = useI18n();
  const [draft, setDraft] = useState([]);
  const [error, setError] = useState(null);
  const sig = expenseCats.map((c) => `${c.key}|${c.name}|${c.color}|${c.budget}`).join();
  useEffect(() => { setDraft(expenseCats.map((c) => ({ ...c, nameText: c.label, budgetText: fmtNum(c.budget, locale) }))); setError(null); }, [sig, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const inUse = (key) => transactions.some((x) => x.type === 'expense' && x.category === key) || templates.some((x) => x.type === 'expense' && x.category === key);
  const upd = (i, patch) => setDraft(draft.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const add = () => setDraft([...draft, { key: `c_${Date.now().toString(36)}`, nameText: '', budgetText: '', color: PALETTE[draft.length % PALETTE.length], isNew: true }]);
  const remove = (i) => { if (inUse(draft[i].key)) { setError('set.cat_in_use'); return; } setDraft(draft.filter((_, j) => j !== i)); };
  const total = round2(draft.filter((c) => !c.system).reduce((a, c) => a + (parseAmount(c.budgetText) || 0), 0));

  async function save() {
    setError(null);
    if (draft.some((c) => !c.system && !c.nameText.trim())) { setError('set.cat_name_required'); return; }
    if (draft.some((c) => c.budgetText && !(parseAmount(c.budgetText) >= 0))) { setError('form.err_amount'); return; }
    const categories = draft.map((c) => {
      const label = c.nameText.trim();
      const defaultLabel = t(`pcat.${c.key}`);
      return { key: c.key, color: c.color, budget: parseAmount(c.budgetText) || 0, name: !c.isNew && label === defaultLabel ? '' : label };
    });
    try { await space.saveSettings({ categories }); notify('common.saved'); } catch (e) { console.error(e); notify('common.error'); }
  }

  return (
    <>
      <SectionTitle>{t('set.my_categories')}</SectionTitle>
      <div className="card p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted">{t('set.my_categories_hint')}</p>
        <div className="space-y-2.5">
          {draft.map((c, i) => (
            <div key={c.key} className="flex items-center gap-2">
              {c.system ? <CatIcon label={c.label} color={c.color} size={34} /> : (
                <button type="button" aria-label={t('set.cat_color')} onClick={() => upd(i, { color: PALETTE[(PALETTE.indexOf(c.color) + 1) % PALETTE.length] })}>
                  <CatIcon label={c.nameText || '?'} color={c.color} size={34} />
                </button>
              )}
              {c.system ? <span className="min-w-0 flex-1 text-sm font-semibold">{c.label}<span className="block text-[11px] font-normal text-muted">{t('set.cat_system')}</span></span> : (
                <input className="field min-w-0 flex-1 py-2" value={c.nameText} placeholder={t('set.cat_name')} aria-label={t('set.cat_name')} onChange={(e) => upd(i, { nameText: e.target.value })} />
              )}
              {!c.system && (
                <span className="relative w-24 shrink-0">
                  <input inputMode="decimal" className="field tabular py-2 pr-6 text-right" value={c.budgetText} placeholder="0" aria-label={t('set.cat_budget')}
                    onChange={(e) => upd(i, { budgetText: e.target.value.replace(/[^\d.,]/g, '') })} />
                  <span className="absolute top-1/2 right-2 -translate-y-1/2 text-sm text-muted">€</span>
                </span>
              )}
              {!c.system && <button type="button" className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:text-danger" aria-label={t('common.delete')} onClick={() => remove(i)}><LuTrash2 size={17} /></button>}
            </div>
          ))}
        </div>
        <button type="button" className="chip mt-3" onClick={add}><LuPlus size={14} /> {t('set.cat_add')}</button>
        {error && <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{t(error)}</p>}
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">{t('set.budget_total')}: <b className="tabular text-ink">{money(total)}</b></span>
          <button className="btn btn-primary py-2" onClick={save}>{t('common.save')}</button>
        </div>
      </div>
    </>
  );
}
