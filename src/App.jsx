import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuLayoutDashboard, LuList, LuPlus, LuRepeat, LuPiggyBank, LuSettings, LuChevronLeft, LuChevronRight, LuWifiOff, LuTriangleAlert, LuHouse, LuUser, LuLock } from 'react-icons/lu';
import { I18nProvider, useI18n } from './i18n/index.jsx';
import { DataProvider, useData, memberNameFor } from './data.jsx';
import { firebaseConfig, members } from './config.js';
import { createDemoStore } from './lib/demoStore.js';
import { makeSpace, homeBase, personalBase } from './lib/space.js';
import { deleteMovement } from './lib/actions.js';
import { touchActivity, isExpired } from './lib/autolock.js';
import { LoginScreen, CHOSEN_KEY } from './screens/LoginScreen.jsx';
import { SpaceChooser } from './screens/SpaceChooser.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { MovementsScreen } from './screens/MovementsScreen.jsx';
import { RecurringScreen } from './screens/RecurringScreen.jsx';
import { SavingsScreen } from './screens/SavingsScreen.jsx';
import { SettingsScreen } from './screens/SettingsScreen.jsx';
import { MovementSheet } from './components/MovementSheet.jsx';
import { TemplateSheet } from './components/TemplateSheet.jsx';
import { GoalSheet } from './components/GoalSheet.jsx';
import { LanguageSelect } from './components/LanguageSelect.jsx';
import { Segmented, Toast, Confirm } from './components/ui.jsx';
import { monthName, todayStr, parseDate, makeDate, daysInMonth, addMonths } from './lib/dates.js';

const useDemo = () => typeof window !== 'undefined' && (window.__PREVIEW__ || new URLSearchParams(location.search).has('demo'));

export default function App() {
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  );
}

function Root() {
  const { t } = useI18n();
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(undefined);
  const [authError, setAuthError] = useState(null);
  const [fatal, setFatal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = firebaseConfig && !useDemo()
          ? await (await import('./lib/firebaseStore.js')).createFirebaseStore(firebaseConfig)
          : createDemoStore();
        if (!cancelled) setStore(s);
      } catch (e) {
        console.error(e);
        if (!cancelled) setFatal('err.network');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!store) return;
    return store.onAuth((u) => {
      if (u && store.mode === 'firebase' && members.length && !members.some((m) => m.email.toLowerCase() === u.email)) {
        setAuthError('not-member'); store.signOut(); return;
      }
      if (u && isExpired()) { setAuthError('idle'); store.signOut(); return; }
      if (u) { setAuthError(null); touchActivity(); }
      setUser(u);
    });
  }, [store]);

  // Cierre de sesión por inactividad
  useEffect(() => {
    if (!store || !user) return;
    let last = 0;
    const onAct = () => { const n = Date.now(); if (n - last > 15000) { last = n; touchActivity(); } };
    const check = () => { if (isExpired()) { setAuthError('idle'); store.signOut(); } };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('pointerdown', onAct);
    window.addEventListener('keydown', onAct);
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(check, 30000);
    return () => { window.removeEventListener('pointerdown', onAct); window.removeEventListener('keydown', onAct); document.removeEventListener('visibilitychange', onVisible); clearInterval(id); };
  }, [store, user]);

  if (fatal) return <Center><p className="text-danger">{t(fatal)}</p><button className="btn btn-primary mt-4" onClick={() => location.reload()}>↻</button></Center>;
  if (!store || user === undefined) return <Center><p className="text-muted">{t('common.loading')}</p></Center>;
  if (!user) return <LoginScreen store={store} externalError={authError} />;
  return <Shell store={store} user={user} />;
}

function Center({ children }) {
  return <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">{children}</div>;
}

const TABS = [
  { key: 'home', icon: LuLayoutDashboard, label: 'nav.home' },
  { key: 'movements', icon: LuList, label: 'nav.movements' },
  { key: 'add', icon: LuPlus, label: 'nav.add' },
  { key: 'recurring', icon: LuRepeat, label: 'nav.recurring' },
  { key: 'savings', icon: LuPiggyBank, label: 'nav.savings' },
];
const SPACE_KEY = 'casa-space';

function Shell({ store, user }) {
  const { t } = useI18n();
  const [toast, setToast] = useState(null);
  const [problem, setProblem] = useState(null);
  const [spaceKey, setSpaceKeyState] = useState(() => { try { return localStorage.getItem(SPACE_KEY) === 'me' ? 'me' : 'home'; } catch { return 'home'; } });
  const [chosen, setChosen] = useState(() => { try { return sessionStorage.getItem(CHOSEN_KEY) === '1'; } catch { return false; } });
  const timer = useRef(null);
  const setSpaceKey = (k) => { setSpaceKeyState(k); setProblem(null); try { localStorage.setItem(SPACE_KEY, k); } catch { /* sin almacenamiento */ } };
  const pick = (k) => { setSpaceKey(k); setChosen(true); try { sessionStorage.setItem(CHOSEN_KEY, '1'); } catch { /* sin almacenamiento */ } window.scrollTo(0, 0); };

  // Color de la barra del sistema (Android) según dónde estés
  useEffect(() => {
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', !chosen ? '#061b2e' : spaceKey === 'me' ? '#9333ea' : '#0ea5e9');
  }, [chosen, spaceKey]);

  const spaces = useMemo(() => ({
    home: makeSpace(store, 'home', homeBase()),
    me: makeSpace(store, 'personal', personalBase(user.uid)),
  }), [store, user.uid]);

  const notify = useCallback((key, vars) => {
    clearTimeout(timer.current);
    setToast({ key, vars });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const onError = useCallback((e) => {
    console.error(e);
    setProblem(e?.code === 'permission-denied' ? 'err.permission' : 'common.error');
  }, []);

  if (!chosen) return <SpaceChooser user={user} onPick={pick} onSignOut={() => store.signOut()} />;

  return (
    <div className={spaceKey === 'me' ? 'space-personal min-h-full' : 'min-h-full'}>
      <DataProvider key={spaceKey} space={spaces[spaceKey]} user={user} onError={onError} onNotice={notify}>
        <Main notify={notify} problem={problem} store={store} spaceKey={spaceKey} setSpaceKey={setSpaceKey} />
      </DataProvider>
      <Toast message={toast ? t(toast.key, toast.vars) : null} />
    </div>
  );
}

function Main({ notify, problem, store, spaceKey, setSpaceKey }) {
  const { t, locale } = useI18n();
  const { ready, space, user } = useData();
  const now = parseDate(todayStr());
  const [tab, setTab] = useState('home');
  const [period, setPeriod] = useState({ year: now.y, month: now.m, mode: 'month' });
  const [movFilter, setMovFilter] = useState(null);
  const [movSheet, setMovSheet] = useState({ open: false, tx: null, defaults: null });
  const [tplSheet, setTplSheet] = useState({ open: false, tpl: null });
  const [goalSheet, setGoalSheet] = useState({ open: false, goal: null });
  const [toDelete, setToDelete] = useState(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  const defaultDate = () => (period.mode === 'month' && (period.year !== now.y || period.month !== now.m)
    ? makeDate(period.year, period.month, Math.min(now.d, daysInMonth(period.year, period.month)))
    : todayStr());
  const openNew = (defaults = {}) => setMovSheet({ open: true, tx: null, defaults: { date: defaultDate(), ...defaults } });
  const openMovement = (tx) => setMovSheet({ open: true, tx, defaults: null });
  const goTo = (key, filter = null) => { setMovFilter(filter); setTab(key); };
  async function confirmDelete() {
    const tx = toDelete; setToDelete(null);
    try { await deleteMovement({ space, user, tx }); notify('common.deleted'); } catch (e) { console.error(e); notify('common.error'); }
  }

  const shift = (dir) => {
    if (period.mode === 'year') setPeriod({ ...period, year: period.year + dir });
    else { const { y, m } = addMonths(period.year, period.month, dir); setPeriod({ ...period, year: y, month: m }); }
  };
  const isCurrent = period.year === now.y && (period.mode === 'year' || period.month === now.m);
  const showPeriod = tab === 'home' || tab === 'movements';
  const title = tab === 'settings' ? t('nav.settings') : t(TABS.find((x) => x.key === tab).label);

  return (
    <div className="mx-auto min-h-full max-w-lg">
      <header className="safe-top sticky top-0 z-30 border-b border-line/70 bg-paper/92 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="font-display text-[26px] font-bold tracking-tight">{title}</h1>
          <div className="flex items-center gap-1.5">
            <LanguageSelect compact />
            <button onClick={() => setTab('settings')} aria-label={t('nav.settings')}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${tab === 'settings' ? 'bg-ink text-white' : 'text-ink hover:bg-black/5'}`}>
              <LuSettings size={20} />
            </button>
          </div>
        </div>
        <div className="px-4 pb-2.5">
          <Segmented value={spaceKey} onChange={setSpaceKey} size="sm" options={[
            { value: 'home', label: t('space.home'), icon: <LuHouse size={15} />, activeClass: 'seg-home' },
            { value: 'me', label: t('space.me', { name: memberNameFor(user.email) }), icon: spaceKey === 'me' ? <LuLock size={14} /> : <LuUser size={15} />, activeClass: 'seg-me' },
          ]} />
        </div>
        {showPeriod && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <Segmented className="w-[8.5rem] shrink-0" size="sm" value={period.mode} onChange={(mode) => setPeriod({ ...period, mode })}
              options={[{ value: 'month', label: t('period.month') }, { value: 'year', label: t('period.year') }]} />
            <div className="flex min-w-0 flex-1 items-center justify-between rounded-[14px] border border-line bg-card p-0.5">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5" onClick={() => shift(-1)} aria-label={t('period.prev')}><LuChevronLeft size={20} /></button>
              <button className="min-w-0 truncate px-1 text-sm font-bold" onClick={() => setPeriod({ year: now.y, month: now.m, mode: period.mode })} title={t('period.today')}>
                {period.mode === 'year' ? period.year : `${monthName(locale, period.month)} ${period.year}`}
                {!isCurrent && <span className="ml-1.5 align-middle text-[10px] font-semibold text-[var(--accent)]">● {t('period.today')}</span>}
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5" onClick={() => shift(1)} aria-label={t('period.next')}><LuChevronRight size={20} /></button>
            </div>
          </div>
        )}
      </header>

      {store.mode === 'demo' && tab === 'home' && <p className="mx-4 mt-3 rounded-2xl bg-warn-soft px-3 py-2 text-xs text-warn-ink">{t('login.demo_note')}</p>}
      {!online && <p className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-black/5 px-3 py-2 text-xs"><LuWifiOff size={14} /> {t('common.offline')}</p>}
      {problem && <p className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-danger-soft px-3 py-2 text-xs text-danger"><LuTriangleAlert size={14} /> {t(problem)}</p>}

      <main className="px-4 pt-4 pb-32">
        {!ready ? <p className="py-20 text-center text-muted">{t('common.loading')}</p> : (
          <>
            {tab === 'home' && <HomeScreen period={period} setPeriod={setPeriod} openMovement={openMovement} goTo={goTo} />}
            {tab === 'movements' && <MovementsScreen period={period} filter={movFilter} openMovement={openMovement} requestDelete={setToDelete} />}
            {tab === 'recurring' && <RecurringScreen openTemplate={(tpl) => setTplSheet({ open: true, tpl })} openNew={openNew} notify={notify} />}
            {tab === 'savings' && <SavingsScreen openGoal={(goal) => setGoalSheet({ open: true, goal })} openNew={openNew} openMovement={openMovement} goTo={goTo} />}
            {tab === 'settings' && <SettingsScreen period={period} notify={notify} store={store} />}
          </>
        )}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-start justify-around px-2 pt-2 pb-2">
          {TABS.map(({ key, icon: Icon, label }) => key === 'add' ? (
            <button key={key} onClick={() => openNew()} aria-label={t(label)}
              className="-mt-6 flex h-[58px] w-[58px] items-center justify-center rounded-[20px] bg-[var(--accent)] text-white shadow-[0_8px_18px_var(--accent-glow)] active:scale-95">
              <Icon size={28} strokeWidth={2.4} />
            </button>
          ) : (
            <button key={key} onClick={() => goTo(key)}
              className={`flex min-w-[58px] flex-col items-center gap-0.5 rounded-xl px-1.5 py-0.5 text-[11px] font-semibold ${tab === key ? 'text-[var(--accent)]' : 'text-muted'}`}>
              <Icon size={22} />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
      </nav>

      <MovementSheet open={movSheet.open} initial={movSheet.tx} defaults={movSheet.defaults} onClose={() => setMovSheet((s) => ({ ...s, open: false }))} notify={notify} />
      <TemplateSheet open={tplSheet.open} template={tplSheet.tpl} onClose={() => setTplSheet((s) => ({ ...s, open: false }))} notify={notify} />
      <GoalSheet open={goalSheet.open} goal={goalSheet.goal} onClose={() => setGoalSheet((s) => ({ ...s, open: false }))} notify={notify} />
      <Confirm open={!!toDelete} danger text={t('form.delete_confirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')}
        onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
    </div>
  );
}
