import { useCallback, useEffect, useRef, useState } from 'react';
import { LuLayoutDashboard, LuList, LuPlus, LuRepeat, LuPiggyBank, LuSettings, LuChevronLeft, LuChevronRight, LuWifiOff, LuTriangleAlert } from 'react-icons/lu';
import { I18nProvider, useI18n } from './i18n/index.jsx';
import { DataProvider, useData } from './data.jsx';
import { firebaseConfig, householdId, members } from './config.js';
import { createDemoStore } from './lib/demoStore.js';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { MovementsScreen } from './screens/MovementsScreen.jsx';
import { RecurringScreen } from './screens/RecurringScreen.jsx';
import { SavingsScreen } from './screens/SavingsScreen.jsx';
import { SettingsScreen } from './screens/SettingsScreen.jsx';
import { MovementSheet } from './components/MovementSheet.jsx';
import { TemplateSheet } from './components/TemplateSheet.jsx';
import { GoalSheet } from './components/GoalSheet.jsx';
import { LanguageSelect } from './components/LanguageSelect.jsx';
import { Segmented, Toast } from './components/ui.jsx';
import { monthName, todayStr, parseDate, makeDate, daysInMonth, addMonths } from './lib/dates.js';

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
        const s = firebaseConfig
          ? await (await import('./lib/firebaseStore.js')).createFirebaseStore(firebaseConfig, householdId)
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
        setAuthError('not-member');
        store.signOut();
        return;
      }
      if (u) setAuthError(null);
      setUser(u);
    });
  }, [store]);

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

function Shell({ store, user }) {
  const { t } = useI18n();
  const [toast, setToast] = useState(null);
  const [problem, setProblem] = useState(null);
  const timer = useRef(null);

  const notify = useCallback((key, vars) => {
    clearTimeout(timer.current);
    setToast({ key, vars });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const onError = useCallback((e) => {
    console.error(e);
    setProblem(e?.code === 'permission-denied' ? 'err.permission' : 'common.error');
  }, []);

  return (
    <DataProvider store={store} user={user} onError={onError} onNotice={notify}>
      <Main notify={notify} problem={problem} />
      <Toast message={toast ? t(toast.key, toast.vars) : null} />
    </DataProvider>
  );
}

function Main({ notify, problem }) {
  const { t, locale } = useI18n();
  const { ready, store } = useData();
  const now = parseDate(todayStr());
  const [tab, setTab] = useState('home');
  const [period, setPeriod] = useState({ year: now.y, month: now.m, mode: 'month' });
  const [movFilter, setMovFilter] = useState(null);
  const [movSheet, setMovSheet] = useState({ open: false, tx: null, defaults: null });
  const [tplSheet, setTplSheet] = useState({ open: false, tpl: null });
  const [goalSheet, setGoalSheet] = useState({ open: false, goal: null });
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  const defaultDate = () => {
    if (period.mode === 'month' && (period.year !== now.y || period.month !== now.m)) {
      return makeDate(period.year, period.month, Math.min(now.d, daysInMonth(period.year, period.month)));
    }
    return todayStr();
  };
  const openNew = (defaults = {}) => setMovSheet({ open: true, tx: null, defaults: { date: defaultDate(), ...defaults } });
  const openMovement = (tx) => setMovSheet({ open: true, tx, defaults: null });
  const goTo = (key, filter = null) => { setMovFilter(filter); setTab(key); };

  const shift = (dir) => {
    if (period.mode === 'year') setPeriod({ ...period, year: period.year + dir });
    else { const { y, m } = addMonths(period.year, period.month, dir); setPeriod({ ...period, year: y, month: m }); }
  };
  const isCurrent = period.year === now.y && (period.mode === 'year' || period.month === now.m);
  const showPeriod = tab === 'home' || tab === 'movements';
  const title = tab === 'settings' ? t('nav.settings') : t(TABS.find((x) => x.key === tab).label);

  return (
    <div className="mx-auto min-h-full max-w-lg">
      <header className="safe-top sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <div className="flex items-center gap-1.5">
            <LanguageSelect compact />
            <button onClick={() => setTab('settings')} aria-label={t('nav.settings')}
              className={`rounded-full p-2 ${tab === 'settings' ? 'bg-ink text-white' : 'text-ink hover:bg-black/5'}`}>
              <LuSettings size={20} />
            </button>
          </div>
        </div>
        {showPeriod && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <Segmented className="w-36 shrink-0" value={period.mode} onChange={(mode) => setPeriod({ ...period, mode })}
              options={[{ value: 'month', label: t('period.month') }, { value: 'year', label: t('period.year') }]} />
            <div className="flex flex-1 items-center justify-between rounded-xl bg-card px-1 py-1 shadow-[0_0_0_1px_var(--color-line)]">
              <button className="rounded-lg p-1.5 hover:bg-black/5" onClick={() => shift(-1)} aria-label={t('period.prev')}><LuChevronLeft size={20} /></button>
              <button className="truncate px-1 text-sm font-bold" onClick={() => setPeriod({ year: now.y, month: now.m, mode: period.mode })} title={t('period.today')}>
                {period.mode === 'year' ? period.year : `${monthName(locale, period.month)} ${period.year}`}
                {!isCurrent && <span className="ml-1.5 align-middle text-[10px] font-semibold text-brand">● {t('period.today')}</span>}
              </button>
              <button className="rounded-lg p-1.5 hover:bg-black/5" onClick={() => shift(1)} aria-label={t('period.next')}><LuChevronRight size={20} /></button>
            </div>
          </div>
        )}
      </header>

      {store.mode === 'demo' && tab === 'home' && (
        <p className="mx-4 mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{t('login.demo_note')}</p>
      )}
      {!online && <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs"><LuWifiOff size={14} /> {t('common.offline')}</p>}
      {problem && <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger"><LuTriangleAlert size={14} /> {t(problem)}</p>}

      <main className="px-4 pt-4 pb-32">
        {!ready ? <p className="py-20 text-center text-muted">{t('common.loading')}</p> : (
          <>
            {tab === 'home' && <HomeScreen period={period} setPeriod={setPeriod} openMovement={openMovement} goTo={goTo} />}
            {tab === 'movements' && <MovementsScreen period={period} filter={movFilter} openMovement={openMovement} />}
            {tab === 'recurring' && <RecurringScreen openTemplate={(tpl) => setTplSheet({ open: true, tpl })} openNew={openNew} notify={notify} />}
            {tab === 'savings' && <SavingsScreen period={period} openGoal={(goal) => setGoalSheet({ open: true, goal })} openNew={openNew} openMovement={openMovement} />}
            {tab === 'settings' && <SettingsScreen period={period} notify={notify} />}
          </>
        )}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5 pb-1.5">
          {TABS.map(({ key, icon: Icon, label }) => key === 'add' ? (
            <button key={key} onClick={() => openNew()} aria-label={t(label)}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 active:scale-95">
              <Icon size={28} />
            </button>
          ) : (
            <button key={key} onClick={() => goTo(key)}
              className={`flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold ${tab === key ? 'text-brand' : 'text-muted'}`}>
              <Icon size={22} />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
      </nav>

      <MovementSheet open={movSheet.open} initial={movSheet.tx} defaults={movSheet.defaults}
        onClose={() => setMovSheet((s) => ({ ...s, open: false }))} notify={notify} />
      <TemplateSheet open={tplSheet.open} template={tplSheet.tpl} onClose={() => setTplSheet((s) => ({ ...s, open: false }))} notify={notify} />
      <GoalSheet open={goalSheet.open} goal={goalSheet.goal} onClose={() => setGoalSheet((s) => ({ ...s, open: false }))} notify={notify} />
    </div>
  );
}
