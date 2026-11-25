// Almacén real: Firebase Auth + Firestore. Trabaja con rutas (['households','main-home','transactions', id]),
// así el mismo código sirve para el espacio del Hogar y para el espacio personal de cada uno.
// El SDK de Firebase se carga desde los servidores oficiales de Google.
import { dueOccurrences, movementFromTemplate } from './finance.js';

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
const load = (name) => import(/* @vite-ignore */ `${CDN}/${name}.js`);

export async function createFirebaseStore(config) {
  const [appMod, authMod, fs] = await Promise.all([load('firebase-app'), load('firebase-auth'), load('firebase-firestore')]);
  const app = appMod.initializeApp(config);
  const auth = authMod.getAuth(app);
  await authMod.setPersistence(auth, authMod.browserLocalPersistence);

  let db;
  try {
    // Caché local: la app funciona sin conexión y sincroniza al volver la red.
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch {
    db = fs.getFirestore(app);
  }
  const ref = (path) => fs.doc(db, ...path);
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  const stamped = (data, stamp) => {
    if (stamp === 'create') return clean({ ...data, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
    if (stamp === 'update') return clean({ ...data, updatedAt: fs.serverTimestamp() });
    return clean(data);
  };

  return {
    mode: 'firebase',
    onAuth(cb) {
      return authMod.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: (u.email || '').toLowerCase() } : null));
    },
    async signIn(email, password) { await authMod.signInWithEmailAndPassword(auth, email.trim(), password); },
    async signOut() { await authMod.signOut(auth); },
    async resetPassword(email) { await authMod.sendPasswordResetEmail(auth, email.trim()); },
    newId() { return fs.doc(fs.collection(db, '_ids')).id; },
    listen(collPath, cb, onError) {
      return fs.onSnapshot(fs.collection(db, ...collPath), (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError);
    },
    listenDoc(docPath, cb, onError) {
      return fs.onSnapshot(ref(docPath), (snap) => cb(snap.exists() ? snap.data() : null), onError);
    },
    // Varias escrituras a la vez: o se guardan todas o ninguna.
    async commit(ops) {
      const batch = fs.writeBatch(db);
      for (const op of ops) {
        if (op.type === 'delete') batch.delete(ref(op.path));
        else if (op.type === 'update') batch.update(ref(op.path), stamped(op.data, op.stamp));
        else batch.set(ref(op.path), stamped(op.data, op.stamp), op.merge ? { merge: true } : undefined);
      }
      await batch.commit();
    },
    // Transacción: aunque los dos abráis la app a la vez, cada recibo se crea una sola vez.
    async generateRecurring({ tplPath, txColl, by, extra }) {
      return fs.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref(tplPath));
        if (!snap.exists()) return 0;
        const tpl = { ...snap.data(), id: snap.id };
        const occ = dueOccurrences(tpl);
        if (!occ.length) return 0;
        for (const o of occ) {
          const txId = `${tpl.id}_${o.period}`;
          const mov = movementFromTemplate(tpl, o, by);
          tx.set(ref([...txColl, txId]), stamped(mov, 'create'));
          for (const e of (extra ? extra(tpl, mov, txId) : [])) tx.set(ref(e.path), stamped(e.data, 'create'));
        }
        tx.update(ref(tplPath), { lastPeriod: occ[occ.length - 1].period });
        return occ.length;
      });
    },
    // Borra todos los documentos de las colecciones de un espacio.
    async wipe(base, colls) {
      for (const c of colls) {
        const snap = await fs.getDocs(fs.collection(db, ...base, c));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = fs.writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    },
  };
}
