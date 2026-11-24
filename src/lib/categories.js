import {
  LuHouse, LuShoppingCart, LuCar, LuHeartPulse, LuWrench, LuBriefcase, LuGift, LuCoins, LuPiggyBank,
} from 'react-icons/lu';

// Claves internas fijas: el texto visible sale de las traducciones (cat.<clave>).
export const EXPENSE_CATEGORIES = [
  { key: 'housing', icon: LuHouse, color: 'var(--color-cat-housing)' },
  { key: 'food', icon: LuShoppingCart, color: 'var(--color-cat-food)' },
  { key: 'transport', icon: LuCar, color: 'var(--color-cat-transport)' },
  { key: 'leisure', icon: LuHeartPulse, color: 'var(--color-cat-leisure)' },
  { key: 'unexpected', icon: LuWrench, color: 'var(--color-cat-unexpected)' },
];

export const INCOME_CATEGORIES = [
  { key: 'salary', icon: LuBriefcase, color: 'var(--color-income)' },
  { key: 'bonus', icon: LuGift, color: 'var(--color-income)' },
  { key: 'other_income', icon: LuCoins, color: 'var(--color-income)' },
];

export const SAVING_STYLE = { icon: LuPiggyBank, color: 'var(--color-saving)' };

export const FREQUENCIES = ['monthly', 'quarterly', 'annual'];
export const FREQ_STEP = { monthly: 1, quarterly: 3, annual: 12 };

export function categoryMeta(type, key) {
  if (type === 'saving') return SAVING_STYLE;
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.key === key) || list[list.length - 1];
}

// Presupuesto mensual inicial (editable en Ajustes).
export const DEFAULT_BUDGETS = { housing: 900, food: 500, transport: 200, leisure: 300, unexpected: 100 };
