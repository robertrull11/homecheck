// Un "espacio" es un conjunto de datos con sus movimientos, fijos, huchas y ajustes:
//  - el Hogar (compartido):     households/<id>/...
//  - el espacio personal:       users/<uid>/...  (solo su dueño puede leerlo: lo garantizan las reglas de Firestore)
import { householdId } from '../config.js';

export const COLLS = ['transactions', 'templates', 'goals', 'settings'];
export const CONTRIB_CATEGORY = 'to_household'; // gasto personal "Aportación al hogar"
export const CONTRIB_INCOME = 'contribution';   // ingreso del hogar que genera

export const homeBase = () => ['households', householdId];
export const personalBase = (uid) => ['users', uid];

export function makeSpace(store, kind, base) {
  const p = (c, id) => (id ? [...base, c, id] : [...base, c]);
  return {
    kind, base, path: p,
    subscribe: (c, cb, onError) => store.listen(p(c), cb, onError),
    subscribeSettings: (cb, onError) => store.listenDoc([...base, 'settings', 'main'], (d) => cb(d || {}), onError),
    newId: () => store.newId(),
    commit: (ops) => store.commit(ops),
    add: async (c, data) => { const id = store.newId(); await store.commit([{ type: 'set', path: p(c, id), data, stamp: 'create' }]); return id; },
    update: (c, id, patch) => store.commit([{ type: 'update', path: p(c, id), data: patch, stamp: 'update' }]),
    remove: (c, id) => store.commit([{ type: 'delete', path: p(c, id) }]),
    saveSettings: (patch) => store.commit([{ type: 'set', path: [...base, 'settings', 'main'], data: patch, merge: true }]),
    generateRecurring: (tplId, by, extra) => store.generateRecurring({ tplPath: p('templates', tplId), txColl: p('transactions'), by, extra }),
    wipe: () => store.wipe(base, COLLS),
  };
}

// ── Aportaciones al hogar ──
// Un gasto personal en la categoría "Aportación al hogar" crea un ingreso enlazado en el Hogar.
// El ingreso del Hogar solo muestra el importe y quién aporta: nada más del espacio personal.
export const contribId = (personalTxId) => `c_${personalTxId}`;

export function contribDoc(mov, personalTxId, user, concept) {
  return {
    type: 'income', category: CONTRIB_INCOME, concept, amount: Math.abs(mov.amount),
    date: mov.date, year: mov.year, month: mov.month, frequency: mov.frequency || 'one-off',
    notes: '', createdBy: user.email, linkedFrom: { uid: user.uid, txId: personalTxId },
  };
}

// Operaciones para mantener sincronizado el ingreso enlazado del Hogar.
export function contribOps({ before, after, personalTxId, user, concept }) {
  const path = [...homeBase(), 'transactions', contribId(personalTxId)];
  const wasLinked = before && before.type === 'expense' && before.category === CONTRIB_CATEGORY;
  const isLinked = after && after.type === 'expense' && after.category === CONTRIB_CATEGORY;
  if (isLinked) return [{ type: 'set', path, data: contribDoc(after, personalTxId, user, concept), stamp: 'create' }];
  if (wasLinked) return [{ type: 'delete', path }];
  return [];
}
