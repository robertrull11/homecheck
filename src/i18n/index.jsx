import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { translations as base, LANGUAGES } from './translations.js';
import { extraTranslations } from './translations2.js';
import { chooserTranslations } from './translations3.js';
import { importTranslations } from './translations4.js';
import { calendarTranslations } from './translations5.js';
import { sharedTranslations } from './translations6.js';
import { compareTranslations } from './translations7.js';
import { v4Translations } from './translations8.js';
import { installTranslations } from './translations9.js';
import { currency } from '../config.js';

const translations = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v, ...extraTranslations[k], ...chooserTranslations[k], ...importTranslations[k], ...calendarTranslations[k], ...sharedTranslations[k], ...compareTranslations[k], ...v4Translations[k], ...installTranslations[k] }]));

const I18nContext = createContext(null);
const STORAGE_KEY = 'casa-lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) return saved;
  } catch { /* sin almacenamiento */ }
  const nav = (navigator.language || 'es').slice(0, 2);
  return translations[nav] ? nav : 'es';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* sin almacenamiento */ }
  };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const value = useMemo(() => {
    const dict = translations[lang];
    const locale = LANGUAGES.find((l) => l.code === lang).locale;
    const moneyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const moneyFmt0 = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
    const t = (key, vars) => {
      let s = dict[key] ?? translations.es[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
      return s;
    };
    return {
      lang, setLang, t, locale,
      money: (n) => moneyFmt.format(n || 0),
      money0: (n) => moneyFmt0.format(Math.round(n || 0)),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
