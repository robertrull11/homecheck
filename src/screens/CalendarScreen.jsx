import { useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuCalendarDays, LuRepeat, LuSparkles } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CatIcon, Empty, SectionTitle, Sheet } from '../components/ui.jsx';
import { forecast } from '../lib/forecast.js';
import { monthName, todayStr, parseDate, daysInMonth, makeDate, formatShortDate, formatDayHeader } from '../lib/dates.js';

const round2 = (n) => Math.round(n * 100) / 100;
const addDays = (date, n) => { const { y, m, d } = parseDate(date); const x = new Date(y, m - 1, d + n); return makeDate(x.getFullYear(), x.getMonth() + 1, x.getDate()); };

// Calendario del año: cargos ya pagados (gris) y próximos cargos previstos (color del espacio).
export function CalendarScreen() {
  const { t, money, money0, locale } = useI18n();
  const { transactions, templates, categoryOf } = useData();
  const today = todayStr();
  const now = parseDate(today);
  const [year, setYear] = useState(now.y);
  const [day, setDay] = useState(null);

  const horizonEnd = `${Math.max(year, now.y + 1)}-12-31`;
  const upcoming = useMemo(() => forecast({ templates, transactions, from: addDays(today, 1), to: horizonEnd, today }),
    [templates, transactions, today, horizonEnd]);

  const byDate = useMemo(() => {
    const map = new Map();
    const add = (date, item) => { if (!map.has(date)) map.set(date, []); map.get(date).push(item); };
    for (const tx of transactions) if (tx.type === 'expense' && tx.year === year && tx.date <= today) add(tx.date, { ...tx, kind: 'paid' });
    for (const it of upcoming) if (it.date.startsWith(`${year}-`)) add(it.date, it);
    return map;
  }, [transactions, upcoming, year, today]);

  const in30 = addDays(today, 30);
  const next30 = upcoming.filter((i) => i.date <= in30);
  const restYear = upcoming.filter((i) => i.date.startsWith(`${now.y}-`));
  const sum = (list) => round2(list.reduce((a, i) => a + Math.abs(i.amount), 0));
  const firstDow = (y, m) => (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes primero
  const dows = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));

  const monthsUpcoming = useMemo(() => {
    const groups = new Map();
    for (const it of upcoming) {
      if (!it.date.startsWith(`${year}-`)) continue;
      const k = it.date.slice(0, 7);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    return [...groups.entries()];
  }, [upcoming, year]);

  const dayItems = day ? byDate.get(day) || [] : [];
  const label = (it) => categoryOf('expense', it.category);
  const Tag = ({ kind }) => (kind === 'paid' ? <span className="rounded-md bg-tint px-1.5 py-0.5 text-[10px] font-bold text-muted">{t('cal.paid')}</span>
    : kind === 'fixed' ? <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-dark)]"><LuRepeat size={10} />{t('cal.fixed')}</span>
      : <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-dark)]"><LuSparkles size={10} />{t('cal.estimated')}</span>);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[20px] bg-[var(--accent)] p-4 text-white">
          <p className="text-[12px] opacity-85">{t('cal.next30')}</p>
          <p className="font-display tabular mt-1 text-[26px] leading-none font-bold">{money0(sum(next30))}</p>
          <p className="mt-1.5 text-[11px] opacity-85">{t('cal.charges', { count: next30.length })}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-muted">{t('cal.rest_year', { year: now.y })}</p>
          <p className="font-display tabular mt-1 text-[26px] leading-none font-bold">{money0(sum(restYear))}</p>
          <p className="mt-1.5 text-[11px] text-muted">{t('cal.charges', { count: restYear.length })}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-[14px] border border-line bg-card p-0.5">
        <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5" onClick={() => setYear(year - 1)} aria-label={t('period.prev')}><LuChevronLeft size={20} /></button>
        <button className="px-2 text-sm font-bold" onClick={() => setYear(now.y)}>{year}</button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5" onClick={() => setYear(year + 1)} aria-label={t('period.next')}><LuChevronRight size={20} /></button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />{t('cal.legend_future')}</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-[#b9c7c9]" />{t('cal.legend_past')}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const total = sum([...byDate.entries()].filter(([d]) => d.startsWith(`${year}-${String(m).padStart(2, '0')}`)).flatMap(([, l]) => l));
          const isNowMonth = year === now.y && m === now.m;
          return (
            <div key={m} className={`card p-2.5 ${isNowMonth ? 'ring-2 ring-[var(--accent)]/40' : ''}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-1 px-0.5">
                <span className="truncate text-[13px] font-bold capitalize">{monthName(locale, m)}</span>
                {total > 0 && <span className="tabular shrink-0 text-[11px] font-semibold text-muted">{money0(total)}</span>}
              </div>
              <div className="grid grid-cols-7 text-center text-[9px] font-semibold text-muted">{dows.map((d, k) => <span key={k}>{d}</span>)}</div>
              <div className="mt-0.5 grid grid-cols-7 gap-y-0.5 text-center">
                {Array.from({ length: firstDow(year, m) }, (_, k) => <span key={`e${k}`} />)}
                {Array.from({ length: daysInMonth(year, m) }, (_, k) => {
                  const date = makeDate(year, m, k + 1);
                  const items = byDate.get(date);
                  const future = items?.some((x) => x.kind !== 'paid');
                  const paid = items?.length && !future;
                  return (
                    <button key={date} type="button" disabled={!items} onClick={() => setDay(date)}
                      aria-label={items ? `${formatShortDate(locale, date)}: ${money(sum(items))}` : undefined}
                      className={`mx-auto flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10.5px] tabular
                        ${future ? 'bg-[var(--accent)] font-bold text-white' : paid ? 'bg-[#dde6e7] font-semibold text-ink' : 'text-ink/70'}
                        ${date === today ? 'ring-2 ring-ink/70' : ''}`}>
                      {k + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>{t('cal.upcoming')}</SectionTitle>
      {monthsUpcoming.length === 0 ? (
        <Empty icon={LuCalendarDays} text={year < now.y ? t('cal.past_year') : t('cal.empty')} />
      ) : monthsUpcoming.map(([k, list]) => (
        <div key={k} className="mb-3">
          <div className="mb-1.5 flex justify-between px-1 text-xs font-bold text-muted">
            <span className="capitalize">{monthName(locale, +k.slice(5))} {k.slice(0, 4)}</span>
            <span className="tabular">{money(sum(list))}</span>
          </div>
          <div className="card divide-y divide-hair overflow-hidden">
            {list.map((it) => {
              const c = label(it);
              return (
                <button key={it.id} type="button" onClick={() => setDay(it.date)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                  <CatIcon label={c.label} color={c.color} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{it.concept}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted">{formatShortDate(locale, it.date)} <Tag kind={it.kind} /></p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-bold">{it.kind === 'estimated' ? '≈ ' : ''}−{money(Math.abs(it.amount))}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted">{t('cal.hint')}</p>

      <Sheet open={!!day} title={day ? formatDayHeader(locale, day) : ''} onClose={() => setDay(null)}>
        <div className="card divide-y divide-hair overflow-hidden">
          {dayItems.map((it, i) => {
            const c = label(it);
            return (
              <div key={it.id || i} className="flex items-center gap-3 px-3.5 py-3">
                <CatIcon label={c.label} color={c.color} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{it.concept}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">{c.label} <Tag kind={it.kind} /></p>
                </div>
                <span className="tabular shrink-0 text-sm font-bold">{it.kind === 'estimated' ? '≈ ' : ''}−{money(Math.abs(it.amount))}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex justify-between px-1 text-sm"><span className="text-muted">{t('cal.day_total')}</span><b className="tabular">{money(sum(dayItems))}</b></p>
      </Sheet>
    </div>
  );
}
