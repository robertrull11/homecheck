// Almacén real: Firebase Auth + Firestore (datos compartidos en tiempo real entre los dos).
// El SDK de Firebase se carga desde los servidores oficiales de Google.
import { dueOccurrences, movementFromTemplate } from './finance.js';
import { DEFAULT_BUDGETS } from './categories.js';

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
const load = (name) => import(/* @vite-ignore */ `${CDN}/${name}.js`);

export async function createFirebaseStore(config, householdId) {
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
  const base = ['households', householdId];
  const col = (c) => fs.collection(db, ...base, c);
  const docRef = (c, id) => fs.doc(db, ...base, c, id);
  const settingsRef = fs.doc(db, ...base, 'settings', 'main');
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

  return {
    mode: 'firebase',
    onAuth(cb) { return authMod.onAuthStateChanged(auth, (u) => cb(u ? { email: (u.email || '').toLowerCase() } : null)); },
    async signIn(email, password) { await authMod.signInWithEmailAndPassword(auth, email.trim(), password); },
    async signOut() { await authMod.signOut(auth); },
    async resetPassword(email) { await authMod.sendPasswordResetEmail(auth, email.trim()); },
    subscribe(c, cb, onError) {
      return fs.onSnapshot(col(c), (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError);
    },
    subscribeSettings(cb, onError) {
      return fs.onSnapshot(settingsRef, (snap) => cb(snap.exists() ? snap.data() : { budgets: { ...DEFAULT_BUDGETS } }), onError);
    },
    async add(c, data) {
      const ref = await fs.addDoc(col(c), clean({ ...data, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() }));
      return ref.id;
    },
    async update(c, id, patch) { await fs.updateDoc(docRef(c, id), clean({ ...patch, updatedAt: fs.serverTimestamp() })); },
    async remove(c, id) { await fs.deleteDoc(docRef(c, id)); },
    async saveSettings(patch) { await fs.setDoc(settingsRef, patch, { merge: true }); },
    // Transacción: aunque los dos abráis la app a la vez, cada recibo se crea una sola vez.
    async generateRecurring(templateId, by) {
      return fs.runTransaction(db, async (tx) => {
        const tplSnap = await tx.get(docRef('templates', templateId));
        if (!tplSnap.exists()) return 0;
        const tpl = { ...tplSnap.data(), id: tplSnap.id };
        const occ = dueOccurrences(tpl);
        if (!occ.length) return 0;
        for (const o of occ) {
          tx.set(docRef('transactions', `${tpl.id}_${o.period}`), {
            ...movementFromTemplate(tpl, o, by), createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp(),
          });
        }
        tx.update(docRef('templates', templateId), { lastPeriod: occ[occ.length - 1].period });
        return occ.length;
      });
    },
  };
}
