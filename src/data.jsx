import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { members } from './config.js';
import { dueOccurrences } from './lib/finance.js';
import { expenseCategoriesFor, incomeCategoriesFor, SAVING_COLOR } from './lib/categories.js';
import { linkedHomeDocs } from './lib/space.js';
import { useI18n } from './i18n/index.jsx';

const DataContext = createContext(null);
const DEMO_EMAILS = ['robert@ejemplo.com', 'arantxa@ejemplo.com'];
const MEMBER_STYLES = [{ bg: '#0B7C86', fg: '#FFFFFF' }, { bg: '#F2A541', fg: '#3A2604' }];

function memberIndex(email = '') {
  const e = email.toLowerCase();
  const i = members.findIndex((m) => m.email.toLowerCase() === e);
  if (i >= 0) return i;
  const d = DEMO_EMAILS.indexOf(e);
  return d >= 0 ? d : 0;
}

export function memberNameFor(email) {
  if (!email) return '';
  const m = members.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (m) return m.name;
  const local = email.split('@')[0].replace(/[^a-zA-ZÀ-ÿ]/g, '');
  return local.charAt(0).toUpperCase() + local.slice(1);
}
export const memberStyle = (email) => MEMBER_STYLES[memberIndex(email) % MEMBER_STYLES.length];

export function DataProvider({ space, user, onError, onNotice, children }) {
  const { t } = useI18n();
  const [transactions, setTransactions] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [goals, setGoals] = useState(null);
  const [settings, setSettings] = useState(null);
  const [tick, setTick] = useState(0);
  const inFlight = useRef(new Set());

  useEffect(() => {
    setTransactions(null); setTemplates(null); setGoals(null); setSettings(null);
    const unsubs = [
      space.subscribe('transactions', setTransactions, onError),
      space.subscribe('templates', setTemplates, onError),
      space.subscribe('goals', setGoals, onError),
      space.subscribeSettings(setSettings, onError),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [space]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revisa cada hora y al volver a la app por si ha cambiado el día.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60 * 60 * 1000);
    const onVisible = () => document.visibilityState === 'visible' && setTick((n) => n + 1);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const contribConcept = useCallback(() => t('contrib.concept', { name: memberNameFor(user.email) }), [t, user.email]);

  // Apunta automáticamente los fijos que ya han vencido (y, si es una aportación personal, su ingreso en el Hogar).
  useEffect(() => {
    if (!templates) return;
    const due = templates.filter((tpl) => dueOccurrences(tpl).length > 0 && !inFlight.current.has(tpl.id));
    if (!due.length) return;
    const extra = space.kind === 'personal' ? (tpl, mov, txId) => linkedHomeDocs(mov, txId, user, contribConcept()) : null;
    (async () => {
      let total = 0;
      for (const tpl of due) {
        inFlight.current.add(tpl.id);
        try { total += await space.generateRecurring(tpl.id, user.email, extra); }
        catch (e) { onError?.(e); }
        finally { inFlight.current.delete(tpl.id); }
      }
      if (total > 0) onNotice?.('rec.generated', { count: total });
    })();
  }, [templates, tick, space, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => {
    const expenseCats = expenseCategoriesFor(space.kind, settings, t);
    const incomeCats = incomeCategoriesFor(space.kind, t);
    const sortedGoals = (goals || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const categoryOf = (type, key) => {
      if (type === 'saving') {
        const g = sortedGoals.find((x) => x.id === key);
        return { key, label: g?.name || t('type.saving'), color: SAVING_COLOR };
      }
      const list = type === 'income' ? incomeCats : expenseCats;
      return list.find((c) => c.key === key) || { key, label: t('cat.other_income'), color: '#475569' };
    };
    return {
      space, user, kind: space.kind, settings: settings || {},
      ready: transactions !== null && templates !== null && goals !== null && settings !== null,
      transactions: transactions || [],
      templates: templates || [],
      goals: sortedGoals,
      expenseCats, incomeCats, categoryOf,
      memberName: memberNameFor, memberStyle, contribConcept,
    };
  }, [space, user, transactions, templates, goals, settings, t, contribConcept]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
