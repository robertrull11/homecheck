// Comercios: agrupa los gastos por el sitio donde se hicieron (restaurante, tienda, gasolinera…)
// para ver cuántas veces se ha ido, cuánto se ha gastado cada año y compararlo con el anterior.
// El banco escribe el mismo sitio de formas distintas («Rest platets», «Restaurant platets vilafr»),
// así que el nombre se reduce a una clave; lo que no se junte solo, se puede juntar a mano.

// Movimientos que no son de un comercio: bizums, transferencias, efectivo, comisiones…
const NOT_A_SHOP = /^(bizum|transferencia|traspaso|traspas|trf\b|abono|ingreso|disposic|ret\.? efectivo|retirada|comisi|pago de impuestos|apunte|venta de divisas|recobro)/i;
// Prefijos de pasarelas de pago: «Paypal *temu» es Temu
const GATEWAY = /^(paypal|hpy|mgp|sumup|zettle_?|sq|nyx)\s*\*\s*/i;

const LEGAL = new Set(['s', 'l', 'sl', 'sa', 'slu', 'u', 'es', 'dees', 'sees', 'sccl', 'scp', 'sc', 'cb', 'sll', 'sau', 'gmbh', 'ag', 'ltd', 'limited', 'inc', 'co', 'unipers', 'compania', 'compa']);
const STOP = new Set(['de', 'del', 'la', 'el', 'les', 'els', 'los', 'las', 'i', 'y', 'a', 'al', 'd', 'n', 'num', 'nam', 'ii', 'iii']);
// Palabras que describen el tipo de sitio, no cuál es. Las de comer y beber (y las que no dicen nada)
// no forman parte de la clave; las demás sí, para no juntar «Estanc rambla» con «Cafe de la rambla».
const GENERIC = new Set(['restaurant', 'restaurante', 'rest', 'bar', 'cafe', 'cafeteria', 'pizzeria', 'gelateria', 'gelats', 'taberna', 'supermercat',
  'supermercado', 'can', 'cal', 'ca', 'corp', 'alim', 'emp', 'mun', 'aj', 'pago', 'adeudo', 'directo', 'sepa', 'recibo', 'gran', 'grupo', 'casa', 'mi', 'us',
  'e', 'servicios', 'sociedad', 'tapepear']);
const TYPED = { estanc: 'estanc', estanco: 'estanc', farmacia: 'farmacia', parking: 'parking', hotel: 'hotel', forn: 'forn', fleca: 'forn',
  ferreteria: 'ferreteria', ferretaria: 'ferreteria', bazar: 'bazar', basar: 'bazar', xarcuteria: 'xarcuteria', vinateria: 'vinateria' };
// Poblaciones: se quitan para que el mismo sitio con o sin la ciudad cuente como uno
const PLACES = new Set(['vilafranca', 'vilafr', 'penedes', 'pened', 'sitges', 'comarruga', 'comar', 'coma', 'ruga', 'vilanova', 'geltru', 'vendrell', 'barcelona',
  'cubelles', 'olerdola', 'olerdolas', 'calafell', 'roda', 'bara', 'bera', 'sant', 'cugat', 'hospitalet', 'mandri', 'devilafranca', 'denvilafranca', 'villafra',
  'villafravilafranca', 'villafrvilafranca']);

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Clave del comercio (null si el movimiento no es de un comercio)
export function merchantKey(concept = '') {
  let s = String(concept).trim();
  if (!s || NOT_A_SHOP.test(s)) return null;
  // «Pago de adeudo directo sepa · N … Mercedes-Benz Group AG» → «Mercedes-Benz Group AG»
  if (s.includes('·')) s = s.split('·').pop();
  if (s.includes('…')) s = s.split('…').pop();
  s = s.trim().replace(GATEWAY, '');
  const tokens = strip(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    // «Bk17492» → «bk»; «4dcdb» (referencias) fuera
    .map((w) => (/\d/.test(w) ? (/^[a-z]/.test(w) ? w.replace(/\d.*$/, '') : '') : w))
    .filter((w) => w.length > 1 && !LEGAL.has(w) && !STOP.has(w));
  if (!tokens.length) { const k = strip(s).replace(/[^a-z]+/g, ''); return k || null; }
  const type = tokens.map((w) => TYPED[w]).find(Boolean) || '';
  const core = tokens.filter((w) => !GENERIC.has(w) && !TYPED[w] && !PLACES.has(w));
  if (!core.length) return [type || tokens[0], ...tokens.filter((w) => PLACES.has(w))].join(' ');
  const head = core[0].length >= 6 ? core[0] : core.slice(0, 2).join(' ');
  return type ? `${type} ${head}` : head;
}

// «Juntar con…» guardado como lista [{ from, to }] → mapa { from: to }
export const mergeMap = (list = []) => Object.fromEntries((Array.isArray(list) ? list : []).filter((m) => m && m.from && m.to).map((m) => [m.from, m.to]));

// Sigue los «juntar con…» que haya hecho el usuario (merge: { claveHija: claveMadre })
export function resolveKey(key, merge = {}) {
  let k = key;
  for (let i = 0; i < 8 && merge[k] && merge[k] !== k; i++) k = merge[k];
  return k;
}

const mostCommon = (arr) => {
  const c = new Map();
  for (const v of arr) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};
const nice = (s) => {
  let t = String(s);
  if (/·|…/.test(t) && !NOT_A_SHOP.test(t)) t = t.split('·').pop().split('…').pop();
  t = t.trim().replace(GATEWAY, '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const round2 = (n) => Math.round(n * 100) / 100;

// Agrupa los gastos por comercio. Devuelve todos los comercios con su historial y totales por año.
export function buildMerchants(transactions, { merge = {}, excludeCategories = [] } = {}) {
  const groups = new Map();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || excludeCategories.includes(tx.category)) continue;
    if (tx.linkedFrom && tx.linkedFrom.kind !== 'shared') continue;
    const own = merchantKey(tx.concept);
    if (!own) continue;
    const key = resolveKey(own, merge);
    let g = groups.get(key);
    if (!g) { g = { key, txs: [], keys: new Set() }; groups.set(key, g); }
    g.txs.push(tx);
    g.keys.add(own);
  }
  const list = [];
  for (const g of groups.values()) {
    g.txs.sort((a, b) => b.date.localeCompare(a.date));
    const byYear = {};
    let total = 0;
    for (const tx of g.txs) {
      const y = byYear[tx.year] || (byYear[tx.year] = { n: 0, total: 0 });
      y.n++; y.total = round2(y.total + tx.amount); total = round2(total + tx.amount);
    }
    // El nombre que se enseña: el del propio comercio (no el de los que se le han juntado), el más repetido
    const ownTxs = g.txs.filter((tx) => merchantKey(tx.concept) === g.key);
    list.push({
      key: g.key,
      name: nice(mostCommon((ownTxs.length ? ownTxs : g.txs).map((tx) => tx.concept))),
      category: mostCommon(g.txs.map((tx) => tx.category)),
      txs: g.txs,
      count: g.txs.length,
      total,
      byYear,
      first: g.txs[g.txs.length - 1].date,
      last: g.txs[0].date,
      // Comercios que se han juntado a este (con su nombre), para poder separarlos
      merged: [...g.keys].filter((k) => k !== g.key).map((k) => ({ key: k, name: nice(mostCommon(g.txs.filter((tx) => merchantKey(tx.concept) === k).map((tx) => tx.concept)) || k) })),
    });
  }
  return list;
}
