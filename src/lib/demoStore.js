// Almacén de MODO DEMO: guarda los datos solo en este navegador (sirve para probar la app sin Firebase).
// Tiene la misma "forma" que el almacén de Firebase (rutas, lotes de escrituras, transacciones).
import { dueOccurrences, movementFromTemplate } from './finance.js';
import { parseDate, makeDate, todayStr, addMonths } from './dates.js';
import { homeBase, personalBase, contribDoc, CONTRIB_CATEGORY } from './space.js';

const KEY = 'casa-demo-v2';
export const DEMO_USERS = [
  { uid: 'u-robert', email: 'robert@ejemplo.com' },
  { uid: 'u-arantxa', email: 'arantxa@ejemplo.com' },
];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const key = (path) => path.join('/');
const parentKey = (path) => path.slice(0, -1).join('/');

function load() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function persist(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* sin almacenamiento: seguimos en memoria */ } }

export function createDemoStore() {
  let db = load() || { docs: {}, user: null, seeded: false };
  const listeners = new Set();
  const authListeners = new Set();
  const stamp = () => new Date().toISOString();

  const notify = () => listeners.forEach((l) => l.fire());
  const save = () => { persist(db); notify(); };
  const setDoc = (path, data, mode) => {
    const k = key(path);
    const prev = db.docs[k];
    if (mode === 'update' && !prev) return;
    const merged = mode === 'merge' || mode === 'update' ? { ...(prev || {}), ...data } : { ...data };
    db.docs[k] = { ...merged, id: path[path.length - 1] };
  };

  return {
    mode: 'demo',
    onAuth(cb) { authListeners.add(cb); setTimeout(() => cb(db.user), 0); return () => authListeners.delete(cb); },
    async signIn(email) {
      const u = DEMO_USERS.find((x) => x.email === (email || '').trim().toLowerCase()) || DEMO_USERS[0];
      db.user = u;
      if (!db.seeded) { seed(db); db.seeded = true; }
      persist(db);
      authListeners.forEach((cb) => cb(db.user));
    },
    async signOut() { db.user = null; persist(db); authListeners.forEach((cb) => cb(null)); },
    async resetPassword() { /* en demo no hace nada */ },
    newId: uid,
    listen(collPath, cb) {
      const pk = key(collPath);
      const l = { fire: () => cb(Object.entries(db.docs).filter(([k]) => parentKey(k.split('/')) === pk).map(([, v]) => ({ ...v }))) };
      listeners.add(l); setTimeout(l.fire, 0);
      return () => listeners.delete(l);
    },
    listenDoc(docPath, cb) {
      const k = key(docPath);
      const l = { fire: () => cb(db.docs[k] ? { ...db.docs[k] } : null) };
      listeners.add(l); setTimeout(l.fire, 0);
      return () => listeners.delete(l);
    },
    async commit(ops) {
      for (const op of ops) {
        if (op.type === 'delete') delete db.docs[key(op.path)];
        else {
          const data = op.stamp === 'create' ? { ...op.data, createdAt: stamp(), updatedAt: stamp() } : op.stamp === 'update' ? { ...op.data, updatedAt: stamp() } : op.data;
          setDoc(op.path, data, op.type === 'update' ? 'update' : op.merge ? 'merge' : 'set');
        }
      }
      save();
    },
    async generateRecurring({ tplPath, txColl, by, extra }) {
      const tpl = db.docs[key(tplPath)];
      if (!tpl) return 0;
      const occ = dueOccurrences(tpl);
      if (!occ.length) return 0;
      for (const o of occ) {
        const txId = `${tpl.id}_${o.period}`;
        const mov = movementFromTemplate(tpl, o, by);
        setDoc([...txColl, txId], { ...mov, createdAt: stamp() }, 'set');
        for (const e of (extra ? extra(tpl, mov, txId) : [])) setDoc(e.path, { ...e.data, createdAt: stamp() }, 'set');
      }
      setDoc(tplPath, { lastPeriod: occ[occ.length - 1].period }, 'merge');
      save();
      return occ.length;
    },
    async wipe(base) {
      const prefix = key(base) + '/';
      for (const k of Object.keys(db.docs)) if (k.startsWith(prefix)) delete db.docs[k];
      save();
    },
    resetDemo() { const user = db.user; db = { docs: {}, user, seeded: true }; seed(db); save(); },
  };
}

// ── Datos de ejemplo: desde enero del año pasado hasta hoy ──
function seed(db) {
  const [robert, arantxa] = DEMO_USERS;
  const now = parseDate(todayStr());
  const startY = now.y - 1;
  const put = (path, data) => { db.docs[key(path)] = { ...data, id: path[path.length - 1], createdAt: new Date().toISOString() }; };

  const materialize = (base, t, user, extra) => {
    const id = uid();
    const tpl = { id, type: t.type, category: t.category, concept: t.concept, amount: t.amount, frequency: t.frequency,
      day: t.day, startDate: makeDate(startY, t.startM || 1, t.day), active: true, lastPeriod: null, notes: '', createdBy: user.email };
    for (const o of dueOccurrences(tpl, todayStr(), 999)) {
      const txId = `${id}_${o.period}`;
      const amount = t.vary ? Math.round((t.amount + ((o.month * 37) % 25) - 10) * 100) / 100 : t.amount;
      const mov = { ...movementFromTemplate(tpl, o, user.email), amount };
      put([...base, 'transactions', txId], mov);
      if (extra) extra(mov, txId);
      tpl.lastPeriod = o.period;
    }
    put([...base, 'templates', id], tpl);
  };

  // Hogar
  const H = homeBase();
  [
    { type: 'expense', category: 'housing', concept: 'Hipoteca', amount: 650, frequency: 'monthly', day: 5, by: robert },
    { type: 'expense', category: 'housing', concept: 'Luz', amount: 68.4, frequency: 'monthly', day: 12, by: arantxa, vary: true },
    { type: 'expense', category: 'housing', concept: 'Internet y móviles', amount: 55, frequency: 'monthly', day: 3, by: robert },
    { type: 'expense', category: 'housing', concept: 'Agua', amount: 96, frequency: 'quarterly', day: 20, startM: 3, by: arantxa },
    { type: 'expense', category: 'housing', concept: 'IBI', amount: 480, frequency: 'annual', day: 1, startM: 10, by: robert },
    { type: 'expense', category: 'transport', concept: 'Seguro del coche', amount: 420, frequency: 'annual', day: 15, startM: 3, by: robert },
    { type: 'expense', category: 'leisure', concept: 'Plataformas de streaming', amount: 21.98, frequency: 'monthly', day: 8, by: arantxa },
  ].forEach((t) => materialize(H, t, t.by));
  const gE = uid(), gT = uid();
  put([...H, 'goals', gE], { name: 'Colchón de emergencia', target: 9000 });
  put([...H, 'goals', gT], { name: 'Viajes', target: 2500 });
  materialize(H, { type: 'saving', category: gE, concept: 'Aportación colchón', amount: 250, frequency: 'monthly', day: 6 }, robert);
  materialize(H, { type: 'saving', category: gT, concept: 'Aportación viajes', amount: 100, frequency: 'monthly', day: 6 }, arantxa);

  // Espacios personales: nómina, aportación al hogar (enlazada) y gastos propios
  for (const [user, name, salary, contrib] of [[robert, 'Robert', 2150, 1300], [arantxa, 'Arantxa', 1890, 1200]]) {
    const P = personalBase(user.uid);
    materialize(P, { type: 'income', category: 'salary', concept: 'Nómina', amount: salary, frequency: 'monthly', day: 1 }, user);
    materialize(P, { type: 'expense', category: CONTRIB_CATEGORY, concept: 'Aportación al hogar', amount: contrib, frequency: 'monthly', day: 2 }, user,
      (mov, txId) => put([...H, 'transactions', `c_${txId}`], contribDoc(mov, txId, user, `Aportación de ${name}`)));
    materialize(P, { type: 'expense', category: 'sport_health', concept: 'Gimnasio', amount: 39.9, frequency: 'monthly', day: 1 }, user);
  }

  // Gastos sueltos (pseudoaleatorios pero siempre iguales)
  let r = 7;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const homeExtras = [['food', 'Mercadona', 45, 95, 5], ['food', 'Bon Preu', 20, 60, 2], ['food', 'Farmacia', 8, 25, 1],
    ['transport', 'Gasolina', 50, 70, 2], ['leisure', 'Restaurante', 35, 80, 2]];
  const personalExtras = [['clothes', 'Ropa', 25, 90, 1], ['leisure_out', 'Cañas con amigos', 12, 40, 2], ['gifts', 'Regalo', 15, 60, 1]];
  for (let k = 0; ; k++) {
    const { y, m } = addMonths(startY, 1, k);
    if (y > now.y || (y === now.y && m > now.m)) break;
    const add = (base, list, users) => {
      for (const [category, concept, min, max, times] of list) {
        for (let i = 0; i < times; i++) {
          const date = makeDate(y, m, 1 + Math.floor(rand() * 27));
          const amount = Math.round((min + rand() * (max - min)) * 100) / 100;
          const by = users[Math.floor(rand() * users.length)];
          if (date > todayStr()) continue;
          put([...base, 'transactions', uid()], { type: 'expense', category, concept, amount, date, year: y, month: m, frequency: 'one-off', createdBy: by.email, notes: '' });
        }
      }
    };
    add(H, homeExtras, [robert, arantxa]);
    add(personalBase(robert.uid), personalExtras, [robert]);
    add(personalBase(arantxa.uid), personalExtras, [arantxa]);
  }
}
