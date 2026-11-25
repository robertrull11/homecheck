import { useMemo } from 'react';
import { LuRepeat, LuPlus, LuPause, LuPlay } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CategoryIcon, Empty, SectionTitle } from '../components/ui.jsx';
import { nextOccurrence, round2, dueOccurrences } from '../lib/finance.js';
import { formatShortDate } from '../lib/dates.js';

const PER_MONTH = { monthly: 1, quarterly: 1 / 3, annual: 1 / 12 };

// Al reanudar un fijo en pausa, los cargos que vencieron mientras estaba pausado se saltan (no se apuntan de golpe).
export function resumePatch(tpl) {
  const missed = dueOccurrences({ ...tpl, active: true });
  return missed.length ? { active: true, lastPeriod: missed[missed.length - 1].period } : { active: true };
}

export function RecurringScreen({ openTemplate, openNew, notify }) {
  const { t, money, locale } = useI18n();
  const { templates, goals, store } = useData();

  const sections = useMemo(() => {
    const sorted = templates.slice().sort((a, b) => (b.active !== false) - (a.active !== false) || b.amount - a.amount);
    return ['expense', 'income', 'saving'].map((type) => ({ type, items: sorted.filter((x) => x.type === type) })).filter((s) => s.items.length);
  }, [templates]);

  const monthly = (type) => round2(templates.filter((x) => x.type === type && x.active !== false).reduce((s, x) => s + x.amount * (PER_MONTH[x.frequency] || 1), 0));

  async function toggle(tpl) {
    const patch = tpl.active === false ? resumePatch(tpl) : { active: false };
    try { await store.update('templates', tpl.id, patch); notify('common.saved'); }
    catch (e) { console.error(e); notify('common.error'); }
  }

  return (
    <div>
      <p className="px-1 text-sm leading-relaxed text-muted">{t('rec.intro')}</p>

      {templates.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="card px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{t('rec.monthly_cost')}</p>
            <p className="tabular mt-0.5 text-lg font-bold">{money(monthly('expense'))}</p>
          </div>
          <div className="card px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{t('rec.monthly_income')}</p>
            <p className="tabular mt-0.5 text-lg font-bold text-income">{money(monthly('income'))}</p>
          </div>
        </div>
      )}

      <button className="btn btn-primary mt-4 w-full" onClick={() => openNew({ type: 'expense', category: 'housing', repeat: true })}>
        <LuPlus size={18} /> {t('rec.add')}
      </button>

      {templates.length === 0 && <div className="mt-4"><Empty icon={LuRepeat} text={t('rec.empty')} /></div>}

      {sections.map((sec) => (
        <div key={sec.type}>
          <SectionTitle>{t(`rec.section_${sec.type}`)}</SectionTitle>
          <div className="card divide-y divide-line overflow-hidden">
            {sec.items.map((tpl) => {
              const paused = tpl.active === false;
              const next = nextOccurrence(tpl);
              const label = tpl.type === 'saving' ? goals.find((g) => g.id === tpl.category)?.name : t(`cat.${tpl.category}`);
              return (
                <div key={tpl.id} className={`flex items-center gap-3 px-4 py-3 ${paused ? 'opacity-55' : ''}`}>
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openTemplate(tpl)}>
                    <CategoryIcon type={tpl.type} category={tpl.category} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{tpl.concept}</span>
                      <span className="block truncate text-xs text-muted">
                        {t(`freq.${tpl.frequency}`)} · {label} · {paused ? t('rec.paused') : next ? t('rec.next', { date: formatShortDate(locale, next) }) : ''}
                      </span>
                    </span>
                    <span className={`tabular shrink-0 font-semibold ${tpl.type === 'income' ? 'text-income' : tpl.type === 'saving' ? 'text-saving' : ''}`}>{money(tpl.amount)}</span>
                  </button>
                  <button onClick={() => toggle(tpl)} className="-mr-1 rounded-full p-2 text-muted hover:bg-black/5" aria-label={paused ? t('rec.resume') : t('rec.pause')} title={paused ? t('rec.resume') : t('rec.pause')}>
                    {paused ? <LuPlay size={18} /> : <LuPause size={18} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
