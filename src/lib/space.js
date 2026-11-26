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

// ── Gastos compartidos pagados desde la cuenta personal ──
// Un gasto personal marcado como «compartido» (shared: { category }) se refleja en el Hogar dos veces:
//  - s_<id>:  gasto del Hogar en su categoría, con la marca «pagado desde la cuenta personal de …»
//  - sc_<id>: aportación de esa persona por el mismo importe (el dinero no salió de la cuenta común,
//             así el saldo del Hogar sigue cuadrando con el banco).
export const sharedId = (personalTxId) => `s_${personalTxId}`;
export const sharedContribId = (personalTxId) => `sc_${personalTxId}`;
export const isShared = (mov) => !!(mov && mov.type === 'expense' && mov.shared?.category && mov.category !== CONTRIB_CATEGORY);

export function sharedDocs(mov, personalTxId, user, contribConcept) {
  const tx = (p) => [...homeBase(), 'transactions', p];
  const common = {
    amount: Math.abs(mov.amount), date: mov.date, year: mov.year, month: mov.month,
    frequency: mov.frequency || 'one-off', notes: '', createdBy: user.email,
    linkedFrom: { uid: user.uid, txId: personalTxId, kind: 'shared' },
  };
  return [
    { path: tx(sharedId(personalTxId)), data: { ...common, type: 'expense', category: mov.shared.category, concept: mov.concept, paidFrom: 'personal', paidBy: user.email } },
    { path: tx(sharedContribId(personalTxId)), data: { ...common, type: 'income', category: CONTRIB_INCOME, concept: `${contribConcept} · ${mov.concept}` } },
  ];
}

// Documentos del Hogar que nacen de un movimiento personal (aportación o gasto compartido).
export function linkedHomeDocs(mov, personalTxId, user, contribConcept) {
  if (mov?.homeLink === false && !isShared(mov)) return [];
  if (mov?.type === 'expense' && mov.category === CONTRIB_CATEGORY) return [{ path: [...homeBase(), 'transactions', contribId(personalTxId)], data: contribDoc(mov, personalTxId, user, contribConcept) }];
  if (isShared(mov)) return sharedDocs(mov, personalTxId, user, contribConcept);
  return [];
}

// Operaciones para mantener sincronizados con el Hogar los movimientos personales enlazados.
export function contribOps({ before, after, personalTxId, user, concept }) {
  const tx = (p) => [...homeBase(), 'transactions', p];
  const ops = [];
  // Aportaciones importadas del extracto personal (homeLink: false): el Hogar ya las tiene por su propio
  // extracto, así que no se crea ni se toca ningún ingreso enlazado (evita duplicados al editarlas).
  const flag = after ? (after.homeLink ?? before?.homeLink) : before?.homeLink;
  if (flag === false && !isShared(after) && !isShared(before)) return ops;
  const wasLinked = before && before.type === 'expense' && before.category === CONTRIB_CATEGORY;
  const isLinked = after && after.type === 'expense' && after.category === CONTRIB_CATEGORY;
  if (isLinked) ops.push({ type: 'set', path: tx(contribId(personalTxId)), data: contribDoc(after, personalTxId, user, concept), stamp: 'create' });
  else if (wasLinked) ops.push({ type: 'delete', path: tx(contribId(personalTxId)) });
  if (isShared(after)) ops.push(...sharedDocs(after, personalTxId, user, concept).map((d) => ({ type: 'set', path: d.path, data: d.data, stamp: 'create' })));
  else if (isShared(before)) ops.push({ type: 'delete', path: tx(sharedId(personalTxId)) }, { type: 'delete', path: tx(sharedContribId(personalTxId)) });
  return ops;
}
