// V3 · Tarjeta del asesor en el Resumen + resumen para preguntar a una IA.
import { useMemo, useState } from 'react';
import { LuLightbulb, LuTriangleAlert, LuCalendarClock, LuCircleCheck, LuMessageCircleQuestion, LuCopy, LuCheck } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Sheet } from './ui.jsx';
import { advise, aiSummary } from '../lib/advisor.js';
import { monthName as monthNameRaw, todayStr } from '../lib/dates.js';

const LEVEL = {
  warn: { icon: LuTriangleAlert, cls: 'text-warn' },
  info: { icon: LuCalendarClock, cls: 'text-[var(--accent)]' },
  good: { icon: LuCircleCheck, cls: 'text-income' },
};

function Advice({ a }) {
  const { icon: Icon, cls } = LEVEL[a.level];
  return (
    <div className="flex gap-3 py-3">
      <Icon size={19} className={`mt-0.5 shrink-0 ${cls}`} />
      <div className="min-w-0">
        <p className="text-sm leading-snug font-semibold">{a.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{a.text}</p>
      </div>
    </div>
  );
}

export function AdvisorCard() {
  const { t, money0, locale, lang } = useI18n();
  const { transactions, catsForYear, incomeCats, kind } = useData();
  const [all, setAll] = useState(false);
  const [ai, setAi] = useState(false);
  const [copied, setCopied] = useState(false);
  const today = todayStr();
  const year = +today.slice(0, 4);
  const monthName = (m, style = 'long') => { const s = monthNameRaw(locale, m, style); return lang === 'en' ? s : s.toLowerCase(); };
  const cats = catsForYear(year);

  const items = useMemo(() => advise({ transactions, cats, kind, today, t, money0, monthName }),
    [transactions, cats.map((c) => `${c.key}:${c.budget}`).join(), kind, today, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => (ai ? aiSummary({ transactions, cats, incomeCats, kind, today, t, money0, monthName }) : ''),
    [ai, transactions, kind, today, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!transactions.length) return null;

  async function copy() {
    try { await navigator.clipboard.writeText(summary); }
    catch {
      const ta = document.getElementById('ai-summary');
      ta?.select(); document.execCommand?.('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="card mt-4 px-4 pt-3 pb-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-[17px] font-bold"><LuLightbulb size={19} className="text-[var(--accent)]" /> {t('adv.title')}</p>
        {items.length > 0 && <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-dark)]">{items.length === 1 ? t('adv.count_one') : t('adv.count', { count: items.length })}</span>}
      </div>
      {items.length ? (
        <div className="divide-y divide-hair">{items.slice(0, 2).map((a) => <Advice key={a.id} a={a} />)}</div>
      ) : <p className="py-3 text-sm text-muted">{t('adv.none')}</p>}
      <div className="mt-1 flex gap-2">
        {items.length > 2 && <button type="button" className="btn btn-ghost flex-1 py-2 text-sm" onClick={() => setAll(true)}>{t('adv.see_all')}</button>}
        <button type="button" className="btn btn-ghost flex-1 py-2 text-sm" onClick={() => setAi(true)}><LuMessageCircleQuestion size={16} /> {t('ai.button')}</button>
      </div>

      <Sheet open={all} title={t('adv.title')} onClose={() => setAll(false)}>
        <div className="divide-y divide-hair">{items.map((a) => <Advice key={a.id} a={a} />)}</div>
        <p className="mt-2 mb-3 text-xs leading-relaxed text-muted">{t('adv.how')}</p>
      </Sheet>

      <Sheet open={ai} title={t('ai.title')} onClose={() => setAi(false)}
        footer={<button type="button" className="btn btn-primary w-full py-3" onClick={copy}>{copied ? <><LuCheck size={17} /> {t('ai.copied')}</> : <><LuCopy size={17} /> {t('ai.copy')}</>}</button>}>
        <p className="mb-3 text-sm leading-relaxed text-muted">{t('ai.explain')}</p>
        <textarea id="ai-summary" readOnly value={summary} rows={14} className="field tabular w-full resize-none text-xs leading-relaxed" />
      </Sheet>
    </div>
  );
}
