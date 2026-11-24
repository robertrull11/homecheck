// Almacén de MODO DEMO: guarda los datos solo en este navegador.
// Tiene exactamente la misma "forma" que el almacén de Firebase, así la app no nota la diferencia.
import { DEFAULT_BUDGETS } from './categories.js';
import { dueOccurrences, movementFromTemplate } from './finance.js';
import { parseDate, makeDate, todayStr, addMonths } from './dates.js';

const KEY = 'casa-demo-v1';
const DEMO_USERS = ['robert@ejemplo.com', 'pareja@ejemplo.com'];

function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function persist(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* el navegador no deja guardar: seguimos en memoria */ }
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const emptyDb = () => ({ transactions: {}, templates: {}, goals: {}, settings: { budgets: { ...DEFAULT_BUDGETS } }, user: null });

export function createDemoStore() {
  let db = load() || emptyDb();
  const listeners = { transactions: new Set(), templates: new Set(), goals: new Set(), settings: new Set(), auth: new Set() };

  const list = (c) => Object.values(db[c]);
  const emit = (c) => {
    const value = c === 'settings' ? db.settings : c === 'auth' ? db.user : list(c);
    listeners[c].forEach((cb) => cb(value));
  };
  const commit = (...colls) => { persist(db); colls.forEach(emit); };
  const stamp = () => new Date().toISOString();

  const store = {
    mode: 'demo',
    onAuth(cb) { listeners.auth.add(cb); setTimeout(() => cb(db.user), 0); return () => listeners.auth.delete(cb); },
    async signIn(email) {
      const e = (email || DEMO_USERS[0]).trim().toLowerCase();
      db.user = { email: e };
      if (!Object.keys(db.transactions).length && !Object.keys(db.templates).length) seed(db);
      commit('auth', 'transactions', 'templates', 'goals', 'settings');
    },
    async signOut() { db.user = null; commit('auth'); },
    async resetPassword() { /* en demo no hace nada */ },
    subscribe(c, cb) { listeners[c].add(cb); setTimeout(() => cb(list(c)), 0); return () => listeners[c].delete(cb); },
    subscribeSettings(cb) { listeners.settings.add(cb); setTimeout(() => cb(db.settings), 0); return () => listeners.settings.delete(cb); },
    async add(c, data) {
      const id = uid();
      db[c][id] = { ...data, id, createdAt: stamp(), updatedAt: stamp() };
      commit(c);
      return id;
    },
    async update(c, id, patch) {
      if (!db[c][id]) return;
      db[c][id] = { ...db[c][id], ...patch, id, updatedAt: stamp() };
      commit(c);
    },
    async remove(c, id) { delete db[c][id]; commit(c); },
    async saveSettings(patch) { db.settings = { ...db.settings, ...patch }; commit('settings'); },
    async generateRecurring(templateId, by) {
      const tpl = db.templates[templateId];
      if (!tpl) return 0;
      const occ = dueOccurrences(tpl);
      if (!occ.length) return 0;
      for (const o of occ) {
        const id = `${tpl.id}_${o.period}`;
        if (!db.transactions[id]) db.transactions[id] = { ...movementFromTemplate(tpl, o, by), id, createdAt: stamp(), updatedAt: stamp() };
      }
      db.templates[templateId] = { ...tpl, lastPeriod: occ[occ.length - 1].period };
      commit('transactions', 'templates');
      return occ.length;
    },
    resetDemo() { const user = db.user; db = emptyDb(); db.user = user; seed(db); commit('transactions', 'templates', 'goals', 'settings'); },
  };
  return store;
}

// ── Datos de ejemplo: desde enero del año pasado hasta hoy ──
function seed(db) {
  const [a, b] = DEMO_USERS;
  const now = parseDate(todayStr());
  const startY = now.y - 1;
  const tpls = [
    { type: 'expense', category: 'housing', concept: 'Hipoteca', amount: 650, frequency: 'monthly', day: 5, by: a },
    { type: 'expense', category: 'housing', concept: 'Luz', amount: 68.4, frequency: 'monthly', day: 12, by: b },
    { type: 'expense', category: 'housing', concept: 'Internet y móviles', amount: 55, frequency: 'monthly', day: 3, by: a },
    { type: 'expense', category: 'housing', concept: 'Agua', amount: 96, frequency: 'quarterly', day: 20, startM: 3, by: b },
    { type: 'expense', category: 'housing', concept: 'IBI', amount: 480, frequency: 'annual', day: 1, startM: 10, by: a },
    { type: 'expense', category: 'transport', concept: 'Seguro del coche', amount: 420, frequency: 'annual', day: 15, startM: 3, by: a },
    { type: 'expense', category: 'leisure', concept: 'Gimnasio', amount: 39.9, frequency: 'monthly', day: 1, by: b },
    { type: 'expense', category: 'leisure', concept: 'Plataformas de streaming', amount: 21.98, frequency: 'monthly', day: 8, by: b },
    { type: 'income', category: 'salary', concept: 'Nómina Robert', amount: 2150, frequency: 'monthly', day: 1, by: a },
    { type: 'income', category: 'salary', concept: 'Nómina pareja', amount: 1890, frequency: 'monthly', day: 2, by: b },
  ];
  const goalEmergency = uid(), goalTravel = uid();
  db.goals[goalEmergency] = { id: goalEmergency, name: 'Colchón de emergencia', target: 9000, createdAt: new Date().toISOString() };
  db.goals[goalTravel] = { id: goalTravel, name: 'Viajes', target: 2500, createdAt: new Date().toISOString() };
  tpls.push({ type: 'saving', category: goalEmergency, concept: 'Aportación colchón', amount: 250, frequency: 'monthly', day: 29, by: a });
  tpls.push({ type: 'saving', category: goalTravel, concept: 'Aportación viajes', amount: 100, frequency: 'monthly', day: 29, by: b });

  for (const t of tpls) {
    const id = uid();
    const startM = t.startM || 1;
    const tpl = {
      id, type: t.type, category: t.category, concept: t.concept, amount: t.amount, frequency: t.frequency,
      day: t.day, startDate: makeDate(startY, startM, t.day), active: true, lastPeriod: null, notes: '', createdBy: t.by,
      createdAt: new Date().toISOString(),
    };
    for (const o of dueOccurrences(tpl, todayStr(), 999)) {
      const tid = `${id}_${o.period}`;
      // la luz varía un poco cada mes
      const amount = t.concept === 'Luz' ? Math.round((t.amount + ((o.month * 37) % 25) - 10) * 100) / 100 : t.amount;
      db.transactions[tid] = { ...movementFromTemplate(tpl, o, t.by), amount, id: tid, createdAt: new Date().toISOString() };
      tpl.lastPeriod = o.period;
    }
    db.templates[id] = tpl;
  }

  // Gastos sueltos repartidos por el mes (pseudoaleatorios pero siempre iguales)
  let r = 7;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const extras = [
    ['food', 'Mercadona', 45, 95, 5], ['food', 'Bon Preu', 20, 60, 2], ['food', 'Farmacia', 8, 25, 1],
    ['transport', 'Gasolina', 50, 70, 2], ['transport', 'Peajes', 6, 18, 1],
    ['leisure', 'Restaurante', 35, 80, 2], ['leisure', 'Ropa', 30, 120, 1],
  ];
  for (let k = 0; ; k++) {
    const { y, m } = addMonths(startY, 1, k);
    if (y > now.y || (y === now.y && m > now.m)) break;
    for (const [category, concept, min, max, times] of extras) {
      for (let i = 0; i < times; i++) {
        const day = 1 + Math.floor(rand() * 27);
        const date = makeDate(y, m, day);
        if (date > todayStr()) continue;
        const id = uid();
        db.transactions[id] = {
          id, type: 'expense', category, concept, amount: Math.round((min + rand() * (max - min)) * 100) / 100,
          date, year: y, month: m, frequency: 'one-off', createdBy: rand() > 0.5 ? a : b, notes: '', createdAt: new Date().toISOString(),
        };
      }
    }
    if (m === 6 || m === 12) {
      const id = uid();
      const date = makeDate(y, m, 20);
      if (date <= todayStr()) db.transactions[id] = { id, type: 'income', category: 'bonus', concept: 'Paga extra', amount: 1750, date, year: y, month: m, frequency: 'one-off', createdBy: a, notes: '', createdAt: new Date().toISOString() };
    }
    if (m === 8 && y === startY) {
      const id = uid();
      db.transactions[id] = { id, type: 'expense', category: 'unexpected', concept: 'Reparación lavadora', amount: 185, date: makeDate(y, m, 9), year: y, month: m, frequency: 'one-off', createdBy: b, notes: '', createdAt: new Date().toISOString() };
    }
  }
  db.settings = { budgets: { ...DEFAULT_BUDGETS } };
}
