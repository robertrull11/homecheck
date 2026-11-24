import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { members } from './config.js';
import { dueOccurrences } from './lib/finance.js';
import { DEFAULT_BUDGETS } from './lib/categories.js';

const DataContext = createContext(null);

export function memberNameFor(email) {
  if (!email) return '';
  const m = members.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (m) return m.name;
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function DataProvider({ store, user, onError, onNotice, children }) {
  const [transactions, setTransactions] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [goals, setGoals] = useState(null);
  const [settings, setSettings] = useState(null);
  const [tick, setTick] = useState(0);
  const inFlight = useRef(new Set());

  useEffect(() => {
    const unsubs = [
      store.subscribe('transactions', setTransactions, onError),
      store.subscribe('templates', setTemplates, onError),
      store.subscribe('goals', setGoals, onError),
      store.subscribeSettings(setSettings, onError),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revisa cada hora por si cambia el día con la app abierta.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60 * 60 * 1000);
    const onVisible = () => document.visibilityState === 'visible' && setTick((n) => n + 1);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // Apunta automáticamente los gastos/ingresos fijos que ya han vencido.
  useEffect(() => {
    if (!templates) return;
    const due = templates.filter((tpl) => dueOccurrences(tpl).length > 0 && !inFlight.current.has(tpl.id));
    if (!due.length) return;
    (async () => {
      let total = 0;
      for (const tpl of due) {
        inFlight.current.add(tpl.id);
        try { total += await store.generateRecurring(tpl.id, user.email); }
        catch (e) { onError?.(e); }
        finally { inFlight.current.delete(tpl.id); }
      }
      if (total > 0) onNotice?.('rec.generated', { count: total });
    })();
  }, [templates, tick, store, user.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const memberName = useCallback((email) => memberNameFor(email), []);

  const value = useMemo(() => ({
    store, user, memberName,
    ready: transactions !== null && templates !== null && goals !== null && settings !== null,
    transactions: transactions || [],
    templates: templates || [],
    goals: (goals || []).slice().sort((a, b) => String(a.createdAt?.seconds ?? a.createdAt ?? '').localeCompare(String(b.createdAt?.seconds ?? b.createdAt ?? ''))),
    budgets: { ...DEFAULT_BUDGETS, ...(settings?.budgets || {}) },
  }), [store, user, memberName, transactions, templates, goals, settings]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
