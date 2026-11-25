import { useMemo, useState } from 'react';
import { LuFileUp, LuShieldCheck, LuCircleCheck, LuTriangleAlert, LuLoaderCircle, LuRepeat, LuCopy } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Sheet, CatIcon } from './ui.jsx';
import { readStatements, datedLines } from '../lib/bankImport.js';
import { planImport, buildImportOps, commitInChunks } from '../lib/importPlan.js';
import { monthName, formatShortDate } from '../lib/dates.js';

// Importar el extracto del banco: se lee en el dispositivo, se revisa y se guarda de una vez.
export function ImportSheet({ open, onClose }) {
  const { t, money, locale } = useI18n();
  const { space, user, transactions, expenseCats, incomeCats, settings, contribConcept } = useData();
  const [step, setStep] = useState('pick');
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [year, setYear] = useState(null);
  const [ov, setOv] = useState({});
  const [done, setDone] = useState(0);

  const reset = () => { setStep('pick'); setError(null); setParsed(null); setYear(null); setOv({}); setDone(0); setUnknown([]); };
  const close = () => { reset(); onClose(); };

  const [unknown, setUnknown] = useState([]);

  async function onFile(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setError(null); setUnknown([]); setStep('reading');
    try {
      const { merged: res, unknown: bad } = await readStatements(files);
      if (!res) { setError('imp.err_format'); setStep('pick'); return; }
      if (!res.lines.length) { setError('imp.err_empty'); setStep('pick'); return; }
      setUnknown(bad); setParsed(res); setYear(res.year); setOv({}); setStep('review');
    } catch (err) {
      console.error(err);
      setError('imp.err_read'); setStep('pick');
    }
  }

  const rules = settings.importRules || {};
  const baseRows = useMemo(() => (parsed && year
    ? planImport({ lines: datedLines(parsed, year), transactions, expenseCats, incomeCats, rules })
    : []), [parsed, year, transactions, expenseCats, incomeCats]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = baseRows.map((r) => ({ ...r, ...ov[r.index] }));
  const catsFor = (type) => (type === 'income' ? incomeCats : expenseCats);
  const catLabel = (type, key) => catsFor(type).find((c) => c.key === key);

  function setCategory(row, category) {
    const next = { ...ov };
    for (const r of rows) {
      if (r.index === row.index) next[r.index] = { ...next[r.index], category, byUser: true };
      else if (r.key === row.key && r.type === row.type && !ov[r.index]?.byUser) next[r.index] = { ...next[r.index], category };
    }
    setOv(next);
  }
  const setAction = (row, action) => setOv({ ...ov, [row.index]: { ...ov[row.index], action } });

  const usedFixed = new Set(rows.filter((r) => r.action.startsWith('fixed:')).map((r) => r.action));
  const toImport = rows.filter((r) => r.action !== 'skip');
  const missing = toImport.filter((r) => !r.action.startsWith('fixed:') && !r.category).length;
  const nNew = toImport.filter((r) => r.action === 'new').length;
  const nFixed = toImport.length - nNew;
  const nSkipped = rows.length - toImport.length;

  async function save() {
    setStep('saving');
    try {
      const ops = buildImportOps({ space, user, rows: toImport, rules, contribConcept: contribConcept() });
      await commitInChunks(space, ops);
      setDone(toImport.length); setStep('done');
    } catch (err) {
      console.error(err);
      setError('common.error'); setStep('review');
    }
  }

  const footer = step === 'review' ? (
    <div>
      {missing > 0 && <p className="mb-2 text-center text-xs font-semibold text-warn-ink">{t('imp.missing', { count: missing })}</p>}
      <button className="btn btn-primary h-14 w-full rounded-2xl text-base shadow-[0_8px_18px_var(--accent-glow)]" disabled={!toImport.length || missing > 0} onClick={save}>
        {t('imp.confirm', { count: toImport.length })}
      </button>
    </div>
  ) : null;

  const shift = parsed ? (year || parsed.year) - parsed.year : 0;
  const label = (s) => `${monthName(locale, s.m)} ${s.y + shift}`;
  const period = !parsed?.statement ? String(year || '')
    : parsed.files > 1 && parsed.first && label(parsed.first) !== label(parsed.statement) ? `${label(parsed.first)} – ${label(parsed.statement)}` : label(parsed.statement);

  return (
    <Sheet open={open} title={t('imp.title')} onClose={close} footer={footer}>
      {step === 'pick' && (
        <div className="pb-2 text-center">
          <label className="mt-2 flex cursor-pointer flex-col items-center gap-3 rounded-[24px] border-2 border-dashed border-[var(--accent)]/40 bg-white px-5 py-9 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--accent-soft)] text-[var(--accent-dark)]"><LuFileUp size={30} /></span>
            <span className="font-display text-xl font-bold">{t('imp.pick')}</span>
            <span className="max-w-[30ch] text-sm text-muted text-balance">{t('imp.pick_hint')}</span>
            <span className="btn btn-primary mt-1 px-6">{t('imp.choose_file')}</span>
            <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={onFile} />
          </label>
          {error && <p className="mt-4 rounded-2xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{t(error)}</p>}
          <p className="mx-auto mt-5 flex max-w-[36ch] items-start gap-2 text-left text-xs leading-relaxed text-muted">
            <LuShieldCheck size={18} className="mt-px shrink-0 text-[var(--accent)]" /> {t('imp.privacy')}
          </p>
        </div>
      )}

      {(step === 'reading' || step === 'saving') && (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
          <LuLoaderCircle size={34} className="animate-spin text-[var(--accent)]" />
          <p>{t(step === 'reading' ? 'imp.reading' : 'imp.saving')}</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <LuCircleCheck size={52} className="text-[var(--accent)]" />
          <p className="font-display text-2xl font-bold">{t('imp.done', { count: done })}</p>
          <p className="max-w-[32ch] text-sm text-muted text-balance">{t('imp.learn')}</p>
          <button className="btn btn-primary mt-3 px-8" onClick={close}>{t('imp.close')}</button>
        </div>
      )}

      {step === 'review' && parsed && (
        <div className="pb-2">
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted">{parsed.bank}{parsed.files > 1 ? ` · ${t('imp.files', { count: parsed.files })}` : ''}</p>
                <p className="font-display text-xl font-bold capitalize">{period}</p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                {t('imp.year')}
                <select className="field w-auto py-1.5 text-sm" value={year} onChange={(e) => { setYear(Number(e.target.value)); setOv({}); }}>
                  {[parsed.year - 1, parsed.year, parsed.year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent-dark)]">{t('imp.summary_new', { count: nNew })}</span>
              {nFixed > 0 && <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent-dark)]">{t('imp.summary_fixed', { count: nFixed })}</span>}
              {nSkipped > 0 && <span className="rounded-full bg-tint px-2.5 py-1 text-muted">{t('imp.summary_skip', { count: nSkipped })}</span>}
            </div>
            {parsed.balanceChecked && (parsed.mismatches === 0
              ? <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-income"><LuCircleCheck size={15} /> {t('imp.balance_ok', { amount: money(parsed.closing) })}</p>
              : <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-warn-ink"><LuTriangleAlert size={15} className="mt-px shrink-0" /> {t('imp.balance_bad', { count: parsed.mismatches })}</p>)}
          </div>
          {unknown.length > 0 && <p className="mt-3 rounded-2xl bg-warn-soft px-3 py-2.5 text-xs text-warn-ink">{t('imp.skipped_files', { count: unknown.length, names: unknown.join(', ') })}</p>}
          {error && <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{t(error)}</p>}

          <div className="mt-3 space-y-2">
            {rows.map((r) => {
              const skip = r.action === 'skip';
              const fixedTx = r.action.startsWith('fixed:') ? r.fixedOptions.find((x) => `fixed:${x.id}` === r.action) || r.match : null;
              const cat = catLabel(r.type, fixedTx ? fixedTx.category : r.category);
              return (
                <div key={r.index} className={`card p-3 transition ${skip ? 'opacity-55' : ''} ${!skip && !fixedTx && !r.category ? 'border-warn-line bg-warn-soft/40' : ''}`}>
                  <div className="flex items-start gap-3">
                    <CatIcon label={cat?.label || '?'} color={cat?.color || '#94a3b8'} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{r.concept}</p>
                        <p className={`tabular shrink-0 text-sm font-bold ${r.type === 'income' ? 'text-income' : ''}`}>{r.type === 'income' ? '+' : '−'}{money(r.amount)}</p>
                      </div>
                      <p className="text-xs text-muted">{formatShortDate(locale, r.date)}</p>
                      {r.status === 'imported' && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted"><LuCopy size={13} /> {t('imp.status_imported')}</p>}
                      {r.status === 'duplicate' && skip && <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-muted"><LuCopy size={13} className="mt-px shrink-0" /> {t('imp.status_dup', { concept: r.match.concept, date: formatShortDate(locale, r.match.date) })}</p>}
                      {r.status === 'maybe' && r.action === 'new' && <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-warn-ink"><LuTriangleAlert size={13} className="mt-px shrink-0" /> {t('imp.status_maybe', { concept: r.match.concept })}</p>}
                      {fixedTx && <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-[var(--accent-dark)]"><LuRepeat size={13} className="mt-px shrink-0" /> {t('imp.status_fixed', { concept: fixedTx.concept, from: money(fixedTx.amount), to: money(r.amount) })}</p>}
                    </div>
                  </div>
                  {r.status !== 'imported' && (
                    <div className="mt-2.5 flex gap-2">
                      {!fixedTx && !skip && (
                        <select aria-label={t('form.category')} className={`field min-w-0 flex-1 py-2 text-[13px] ${!r.category ? 'border-warn-line text-warn-ink' : ''}`}
                          value={r.category} onChange={(e) => setCategory(r, e.target.value)}>
                          {!r.category && <option value="">{t('imp.choose_cat')}</option>}
                          {catsFor(r.type).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      )}
                      <select aria-label={t('imp.action')} className={`field py-2 text-[13px] ${fixedTx || skip ? 'min-w-0 flex-1' : 'w-[42%] shrink-0'}`} value={r.action} onChange={(e) => setAction(r, e.target.value)}>
                        <option value="new">{t('imp.act_new')}</option>
                        <option value="skip">{t('imp.act_skip')}</option>
                        {r.fixedOptions.map((x) => (
                          <option key={x.id} value={`fixed:${x.id}`} disabled={usedFixed.has(`fixed:${x.id}`) && r.action !== `fixed:${x.id}`}>
                            {t('imp.act_fixed', { concept: x.concept, amount: money(x.amount) })}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="mt-4 w-full py-2 text-sm font-semibold text-[var(--accent)]" onClick={reset}>{t('imp.other_file')}</button>
        </div>
      )}
    </Sheet>
  );
}
