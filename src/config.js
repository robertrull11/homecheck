// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL HOGAR
// Si firebaseConfig fuera null, la app funcionaría en MODO DEMO
// (datos solo en este navegador, sin compartir).
// Estos valores no son secretos: la seguridad la dan las reglas de Firestore.
// ─────────────────────────────────────────────────────────────

// Proyecto Firebase: homecheck-8983f
export const firebaseConfig = {
  apiKey: 'AIzaSyBY_WZheVhy6_E_LIklcyECWoypTdjUg-Q',
  authDomain: 'homecheck-8983f.firebaseapp.com',
  projectId: 'homecheck-8983f',
  storageBucket: 'homecheck-8983f.firebasestorage.app',
  messagingSenderId: '290875574436',
  appId: '1:290875574436:web:ce748967ce1b87142a3e31',
};

// Las dos personas del hogar. El nombre es el que se ve en la app.
// Deben coincidir con los emails puestos en firestore.rules.
export const members = [
  { email: 'robertrull_@hotmail.com', name: 'Robert' },
  // Pendiente: añadir el email de la pareja (y también en firestore.rules).
];

export const householdId = 'main-home';
export const currency = 'EUR';
