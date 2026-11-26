import { useMemo, useState } from 'react';
import { LuSearch, LuStore, LuChevronRight, LuMerge, LuSplit, LuArrowLeft } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { Sheet, CatIcon, Segmented, Empty } from '../components/ui.jsx';
import { buildMerchants, mergeMap } from '../lib/merchants.js';
import { CONTRIB_CATEGORY } from '../lib/space.js';
import { formatShortDate, todayStr } from '../lib/dates.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Diferencia frente al año anterior: ▲ rojo si se gasta más, ▼ verde si se gasta menos
function Delta({ now, before }) {
  const { t, money0 } = useI18n();
  if (!before) return now > 0 ? <span className="text-[11px] font-semibold text-muted">{t('mer.new')}</span> : null;
  const diff = round2(now - before);
  if (Math.abs(diff) < 0.5) return <span className="text-[11px] font-semibold text-muted">= {t('cmp.same')}</span>;
  const up = diff > 0;
  const p = Math.round((Math.abs(diff) / before) * 100);
  return (
    <span className={`tabular text-[11px] font-bold ${up ? 'text-danger' : 'text-income'}`} title={t(up ? 'cmp.more' : 'cmp.less')}>
      {up ? '▲' : '▼'} {money0(Math.abs(diff))}{p >= 1 && p < 1000 ? ` (${up ? '+' : '−'}${p} %)` : ''}
    </span>
  );
}

// Lo gastado en un comercio un año, opcionalmente solo hasta un día del año (MM-DD)
function spent(m, year, untilMD) {
  let n = 0; let total = 0;
  for (const tx of m.txs) {
    if (tx.year !== year || (untilMD && tx.date.slice(5) > untilMD)) continue;
    n++; total += tx.amount;
  }
  return { n, total: round2(total) };
}

export function MerchantsScreen({ openMovement }) {
  const { t, money, money0, locale } = useI18n();
  const { transactions, settings, space, categoryOf, expenseCats } = useData();
  const merge = useMemo(() => mergeMap(settings.merchantMerge), [settings.merchantMerge]);
  const all = useMemo(() => buildMerchants(transactions, { merge, excludeCategories: [CONTRIB_CATEGORY] }), [transactions, merge]);
  const repeat = useMemo(() => all.filter((m) => m.count >= 2), [all]);
  // Primer año con datos: antes no se puede decir si un comercio es «nuevo»
  const firstYear = useMemo(() => Math.min(...transactions.map((x) => x.year).filter(Boolean)), [transactions]);

  const years = useMemo(() => [...new Set(repeat.flatMap((m) => Object.keys(m.byYear).map(Number)))].sort((a, b) => b - a), [repeat]);
  const today = todayStr();
  const thisYear = +today.slice(0, 4);
  const [yearSel, setYear] = useState(null);
  const year = yearSel && years.includes(yearSel) ? yearSel : years[0];
  const [sort, setSort] = useState('total');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [showIdle, setShowIdle] = useState(false);
  const [openKey, setOpenKey] = useState(null);

  // El año en curso se compara con el mismo periodo del anterior (hasta el mismo día)
  const untilMD = year === thisYear ? today.slice(5) : null;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repeat
      .filter((m) => category === 'all' || m.category === category)
      .filter((m) => !q || `${m.name} ${m.txs.map((x) => x.concept).join(' ')}`.toLowerCase().includes(q))
      .map((m) => ({ m, cur: spent(m, year), prev: spent(m, year - 1, untilMD) }))
      .sort((a, b) => (sort === 'count' ? b.cur.n - a.cur.n : b.cur.total - a.cur.total) || b.m.total - a.m.total);
  }, [repeat, category, query, year, untilMD, sort]);
  const active = rows.filter((r) => r.cur.n > 0);
  const idle = rows.filter((r) => r.cur.n === 0);
  const totalYear = round2(active.reduce((a, r) => a + r.cur.total, 0));
  const cats = expenseCats.filter((c) => !c.system && repeat.some((m) => m.category === c.key));

  const opened = openKey ? all.find((m) => m.key === openKey) : null;

  if (!repeat.length) return <div className="px-4 pt-3"><Empty icon={LuStore} text={t('mer.empty')} /></div>;

  const Row = ({ m, cur, prev }) => {
    const cat = categoryOf('expense', m.category);
    const avg = cur.n ? cur.total / cur.n : 0;
    return (
      <button onClick={() => setOpenKey(m.key)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.03]">
        <CatIcon label={cat.label} color={cat.color} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{m.name}</p>
          <p className="truncate text-xs text-muted">
            {cur.n ? t('mer.row_sub', { count: cur.n, avg: money0(avg) }) : t('mer.last', { date: formatShortDate(locale, m.last) })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-[15px] font-bold">{money(cur.total)}</p>
          {cur.n > 0 && year > firstYear && <Delta now={cur.total} before={prev.total} />}
        </div>
        <LuChevronRight size={16} className="shrink-0 text-muted/60" />
      </button>
    );
  };

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="card p-4">
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button key={y} onClick={() => setYear(y)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${y === year ? 'bg-[var(--accent)] text-white' : 'bg-tint text-muted'}`}>{y}</button>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-muted">{t('mer.summary', { count: active.length, year })}</p>
        <p className="tabular font-display text-3xl font-bold">{money(totalYear)}</p>
        <p className="mt-1 text-xs text-muted">{untilMD ? t('mer.vs_same', { year: year - 1 }) : t('mer.vs_full', { year: year - 1 })}</p>
      </div>

      <div className="mt-3 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <LuSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="field pl-9" placeholder={t('mer.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="field w-[42%] shrink-0" aria-label={t('form.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">{t('mer.all_cats')}</option>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <Segmented className="mt-2" size="sm" value={sort} onChange={setSort}
        options={[{ value: 'total', label: t('mer.sort_total') }, { value: 'count', label: t('mer.sort_count') }]} />

      {active.length > 0 ? (
        <div className="card mt-3 divide-y divide-line overflow-hidden">
          {active.map((r) => <Row key={r.m.key} {...r} />)}
        </div>
      ) : <p className="mt-6 text-center text-sm text-muted">{t('mer.none_year', { year })}</p>}

      {idle.length > 0 && (
        <>
          <button onClick={() => setShowIdle((v) => !v)} className="mt-4 w-full py-2 text-sm font-semibold text-[var(--accent)]">
            {t(showIdle ? 'mer.idle_hide' : 'mer.idle_show', { count: idle.length, year })}
          </button>
          {showIdle && <div className="card mt-1 divide-y divide-line overflow-hidden opacity-80">{idle.map((r) => <Row key={r.m.key} {...r} />)}</div>}
        </>
      )}
      <p className="mt-4 px-2 text-center text-xs text-muted text-balance">{t('mer.hint')}</p>

      <MerchantSheet merchant={opened} all={all} firstYear={firstYear} merge={settings.merchantMerge || []} space={space}
        onClose={() => setOpenKey(null)} openMovement={openMovement} onMerged={(key) => setOpenKey(key)} />
    </div>
  );
}

function MerchantSheet({ merchant: m, all, firstYear, merge, space, onClose, openMovement, onMerged }) {
  const { t, money, money0, locale } = useI18n();
  const { categoryOf } = useData();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  if (!m) return null;

  const years = Object.keys(m.byYear).map(Number).sort((a, b) => a - b);
  const max = Math.max(...years.map((y) => m.byYear[y].total), 1);
  const cat = categoryOf('expense', m.category);
  const byYearDesc = [...years].reverse();

  async function saveMerge(next) {
    setBusy(true);
    try { await space.saveSettings({ merchantMerge: next }); } finally { setBusy(false); }
  }
  async function joinWith(other) {
    // Todo lo del otro comercio (y lo que ya estaba junto a él) pasa a este
    const next = merge.map((x) => (x.to === other.key ? { ...x, to: m.key } : x)).filter((x) => x.from !== other.key);
    next.push({ from: other.key, to: m.key });
    await saveMerge(next);
    setPicking(false); setQ(''); onMerged(m.key);
  }
  async function split(key) {
    await saveMerge(merge.filter((x) => x.from !== key));
  }

  const candidates = all.filter((o) => o.key !== m.key)
    .filter((o) => !q.trim() || `${o.name} ${o.key}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.count - a.count).slice(0, 60);

  return (
    <Sheet open title={picking ? t('mer.join_title') : m.name} onClose={() => { setPicking(false); onClose(); }}>
      {picking ? (
        <div className="pb-2">
          <button className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)]" onClick={() => setPicking(false)}><LuArrowLeft size={16} /> {m.name}</button>
          <p className="mb-3 text-sm text-muted">{t('mer.join_hint', { name: m.name })}</p>
          <label className="relative block">
            <LuSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input autoFocus className="field pl-9" placeholder={t('mer.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="card mt-3 divide-y divide-line overflow-hidden">
            {candidates.map((o) => (
              <button key={o.key} disabled={busy} onClick={() => joinWith(o)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-black/[0.03]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{o.name}</p>
                  <p className="text-xs text-muted">{t('mer.times', { count: o.count })} · {money(o.total)}</p>
                </div>
                <LuMerge size={16} className="shrink-0 text-[var(--accent)]" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="pb-2">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <CatIcon label={cat.label} color={cat.color} size={40} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted">{cat.label}</p>
                <p className="tabular font-display text-2xl font-bold">{money(m.total)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-tint px-2 py-2"><p className="text-[11px] text-muted">{t('mer.visits')}</p><p className="tabular font-bold">{m.count}</p></div>
              <div className="rounded-2xl bg-tint px-2 py-2"><p className="text-[11px] text-muted">{t('mer.avg')}</p><p className="tabular font-bold">{money(m.total / m.count)}</p></div>
              <div className="rounded-2xl bg-tint px-2 py-2"><p className="text-[11px] text-muted">{t('mer.since')}</p><p className="tabular text-sm font-bold">{formatShortDate(locale, m.first)}</p></div>
            </div>
          </div>

          <h3 className="mt-5 mb-2 px-1 text-[15px] font-bold">{t('mer.by_year')}</h3>
          <div className="card p-4">
            <div className="flex h-36 items-end gap-3">
              {years.map((y) => (
                <div key={y} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="tabular text-[11px] font-semibold">{money0(m.byYear[y].total)}</span>
                  <div className="w-full max-w-12 rounded-t-[4px] bg-[var(--accent)]" style={{ height: `${Math.max(4, (m.byYear[y].total / max) * 96)}px` }} />
                  <span className="text-xs font-semibold text-muted">{y}</span>
                </div>
              ))}
            </div>
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-[11px] text-muted"><th className="pb-1 font-semibold">{t('mer.year')}</th><th className="pb-1 text-right font-semibold">{t('mer.visits')}</th><th className="pb-1 text-right font-semibold">{t('mer.total')}</th><th className="pb-1 text-right font-semibold">{t('mer.vs_prev')}</th></tr></thead>
              <tbody>
                {byYearDesc.map((y) => (
                  <tr key={y} className="border-t border-line">
                    <td className="py-1.5 font-semibold">{y}</td>
                    <td className="tabular py-1.5 text-right">{m.byYear[y].n}</td>
                    <td className="tabular py-1.5 text-right font-semibold">{money(m.byYear[y].total)}</td>
                    <td className="py-1.5 text-right">{y > firstYear ? <Delta now={m.byYear[y].total} before={m.byYear[y - 1]?.total || 0} /> : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted">{t('mer.table_note')}</p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button className="btn btn-ghost w-full py-2.5 text-sm" onClick={() => setPicking(true)}><LuMerge size={16} /> {t('mer.join')}</button>
            {m.merged.length > 0 && (
              <div className="card p-3">
                <p className="mb-1 text-xs font-semibold text-muted">{t('mer.includes')}</p>
                {m.merged.map(({ key: k, name }) => (
                  <div key={k} className="flex items-center justify-between gap-2 py-1">
                    <span className="truncate text-sm">{name}</span>
                    {merge.some((x) => x.from === k) && (
                      <button disabled={busy} onClick={() => split(k)} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--accent)]"><LuSplit size={14} /> {t('mer.split')}</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <h3 className="mt-5 mb-2 px-1 text-[15px] font-bold">{t('mer.history')}</h3>
          {byYearDesc.map((y) => (
            <div key={y} className="mb-3">
              <p className="mb-1 flex justify-between px-1 text-xs font-semibold text-muted"><span>{y}</span><span>{t('mer.times', { count: m.byYear[y].n })} · {money(m.byYear[y].total)}</span></p>
              <div className="card divide-y divide-line overflow-hidden">
                {m.txs.filter((tx) => tx.year === y).map((tx) => (
                  <button key={tx.id} onClick={() => openMovement(tx)} className="flex w-full items-center gap-3 px-3 py-2 text-left active:bg-black/[0.03]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{formatShortDate(locale, tx.date)}</p>
                      <p className="truncate text-xs text-muted">{tx.concept}</p>
                    </div>
                    <p className="tabular shrink-0 text-sm font-bold">−{money(tx.amount)}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
