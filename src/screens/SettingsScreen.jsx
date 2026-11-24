import { useEffect, useState } from 'react';
import { LuDownload, LuLogOut, LuSmartphone, LuInfo, LuUndo2 } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CategoryIcon, SectionTitle, Confirm } from '../components/ui.jsx';
import { LanguageSelect } from '../components/LanguageSelect.jsx';
import { EXPENSE_CATEGORIES } from '../lib/categories.js';
import { parseAmount, round2 } from '../lib/finance.js';
import { exportCsv } from '../lib/exportCsv.js';

/* global __APP_VERSION__ */
export function SettingsScreen({ period, notify }) {
  const { t, lang, money, locale } = useI18n();
  const { store, user, transactions, goals, budgets, memberName } = useData();
  const [draft, setDraft] = useState({});
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const fmt = (n) => String(n ?? '').replace('.', locale.startsWith('en') ? '.' : ',');
    setDraft(Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.key, fmt(budgets[c.key])])));
  }, [budgets, locale]);

  const parsed = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v === '' ? 0 : parseAmount(v)]));
  const dirty = EXPENSE_CATEGORIES.some((c) => round2(parsed[c.key] || 0) !== round2(budgets[c.key] || 0));
  const valid = Object.values(parsed).every((n) => Number.isFinite(n) && n >= 0);
  const totalBudget = round2(Object.values(parsed).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0));

  async function saveBudgets() {
    try { await store.saveSettings({ budgets: parsed }); notify('common.saved'); }
    catch (e) { console.error(e); notify('common.error'); }
  }

  const doExport = (year) => exportCsv({ transactions, goals, t, lang, memberName, year });

  return (
    <div>
      <SectionTitle>{t('set.budgets')}</SectionTitle>
      <div className="card p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted">{t('set.budgets_hint')}</p>
        <div className="space-y-2.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center gap-3">
              <CategoryIcon type="expense" category={c.key} size={32} />
              <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{t(`cat.${c.key}`)}</span>
              <span className="relative w-28">
                <input inputMode="decimal" className="field tabular py-2 pr-7 text-right" value={draft[c.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value.replace(/[^\d.,]/g, '') })} aria-label={t(`cat.${c.key}`)} />
                <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted">€</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">{t('set.budget_total')}: <b className="tabular text-ink">{money(totalBudget)}</b></span>
          <button className="btn btn-primary py-2" disabled={!dirty || !valid} onClick={saveBudgets}>{t('common.save')}</button>
        </div>
      </div>

      <SectionTitle>{t('set.language')}</SectionTitle>
      <div className="card flex items-center justify-between p-4">
        <span className="text-sm font-semibold">{t('set.language')}</span>
        <LanguageSelect />
      </div>

      <SectionTitle>{t('set.export')}</SectionTitle>
      <div className="card p-4">
        <p className="mb-3 text-xs leading-relaxed text-muted">{t('set.export_hint')}</p>
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
        <button className="btn btn-danger mt-3 w-full py-2" onClick={() => store.signOut()}><LuLogOut size={16} /> {t('set.sign_out')}</button>
      </div>

      <p className="mt-6 mb-2 text-center text-[11px] text-muted">{t('set.version', { version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev' })}</p>

      <Confirm open={confirmReset} text={t('set.reset_demo_confirm')} confirmLabel={t('set.reset_demo')} cancelLabel={t('common.cancel')} danger
        onCancel={() => setConfirmReset(false)} onConfirm={() => { store.resetDemo(); setConfirmReset(false); notify('common.saved'); }} />
    </div>
  );
}
