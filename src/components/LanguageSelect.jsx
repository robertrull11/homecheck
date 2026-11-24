import { LuLanguages } from 'react-icons/lu';
import { LANGUAGES } from '../i18n/translations.js';
import { useI18n } from '../i18n/index.jsx';

export function LanguageSelect({ compact = false }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full border border-line bg-card py-1.5 pr-2.5 pl-2.5 text-sm font-semibold">
      <LuLanguages size={16} className="text-muted" />
      <span>{LANGUAGES.find((l) => l.code === lang)[compact ? 'short' : 'label']}</span>
      <select
        aria-label={t('set.language')}
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}
