// Categorías.
// Hogar: 5 categorías fijas de gasto (textos traducidos con cat.<clave>), presupuesto en ajustes.
// Personal: categorías editables por cada persona (nombre, color y presupuesto), guardadas en sus ajustes.
import { CONTRIB_CATEGORY, CONTRIB_INCOME } from './space.js';

export const PALETTE = ['#4655C9', '#3E8A2A', '#B25E0E', '#C23A63', '#8A6A00', '#9A3412', '#57534E', '#475569'];

export const HOME_EXPENSE = [
  { key: 'housing', color: '#4655C9' },
  { key: 'food', color: '#3E8A2A' },
  { key: 'transport', color: '#B25E0E' },
  { key: 'leisure', color: '#C23A63' },
  { key: 'education', color: '#7246D9' },
  { key: 'insurance', color: '#57534E' },
  { key: 'unexpected', color: '#8A6A00' },
];
export const DEFAULT_HOME_BUDGETS = { housing: 900, food: 500, transport: 200, leisure: 300, education: 670, insurance: 460, unexpected: 100 };

export const HOME_INCOME = [CONTRIB_INCOME, 'salary', 'bonus', 'other_income'];
export const PERSONAL_INCOME = ['salary', 'bonus', 'other_income'];

// Categorías personales de partida (cada uno puede renombrarlas, añadir y quitar).
export const DEFAULT_PERSONAL = [
  { key: CONTRIB_CATEGORY, color: '#0B7C86', budget: 0, system: true },
  { key: 'clothes', color: '#C23A63', budget: 80 },
  { key: 'leisure_out', color: '#9A3412', budget: 120 },
  { key: 'sport_health', color: '#3E8A2A', budget: 60 },
  { key: 'gifts', color: '#B25E0E', budget: 50 },
  { key: 'transport_p', color: '#4655C9', budget: 60 },
  { key: 'other_p', color: '#475569', budget: 50 },
];

export const INCOME_COLOR = '#1E7A45';
export const SAVING_COLOR = 'var(--accent)';

export const FREQUENCIES = ['monthly', 'quarterly', 'annual'];
export const FREQ_STEP = { monthly: 1, quarterly: 3, annual: 12 };

// Construye la lista de categorías de gasto de un espacio, con su texto y presupuesto.
export function expenseCategoriesFor(kind, settings, t) {
  if (kind === 'home') {
    const budgets = { ...DEFAULT_HOME_BUDGETS, ...(settings?.budgets || {}) };
    return HOME_EXPENSE.map((c) => ({ ...c, label: t(`cat.${c.key}`), budget: Number(budgets[c.key]) || 0 }));
  }
  const list = settings?.categories?.length ? settings.categories : DEFAULT_PERSONAL;
  const withSystem = list.some((c) => c.key === CONTRIB_CATEGORY) ? list : [DEFAULT_PERSONAL[0], ...list];
  return withSystem.map((c) => ({
    key: c.key, color: c.color || PALETTE[0], budget: Number(c.budget) || 0, system: c.key === CONTRIB_CATEGORY,
    name: c.name || '', label: c.name || t(`pcat.${c.key}`),
  }));
}

export function incomeCategoriesFor(kind, t) {
  return (kind === 'home' ? HOME_INCOME : PERSONAL_INCOME).map((key) => ({ key, color: INCOME_COLOR, label: t(`cat.${key}`) }));
}
