import { LuHouse, LuUserRound, LuLock, LuArrowRight, LuLogOut } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { LanguageSelect } from '../components/LanguageSelect.jsx';
import { Backdrop } from './LoginScreen.jsx';
import { memberNameFor } from '../data.jsx';
import { members } from '../config.js';

// Pantalla que aparece al entrar: elegir entre el Hogar (turquesa) y el espacio personal (naranja).
export function SpaceChooser({ user, onPick, onSignOut }) {
  const { t } = useI18n();
  const name = memberNameFor(user.email);
  const partner = members.map((m) => m.name).find((n) => n !== name) || '';

  const Card = ({ k, tone, icon: Icon, title, desc, badge, delay }) => (
    <button type="button" onClick={() => onPick(k)} style={{ '--d': delay }}
      className={`login-rise chooser-card chooser-${tone} group flex w-full flex-col items-center gap-3 rounded-[28px] px-5 pt-7 pb-6 text-center text-white`}>
      <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/20 ring-1 ring-white/35">
        <Icon size={32} strokeWidth={2.1} />
      </span>
      <span className="font-display text-[26px] leading-none font-bold tracking-tight">{title}</span>
      <span className="max-w-[24ch] text-[14px] leading-snug text-white/90 text-balance">{desc}</span>
      {badge}
      <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--tone-ink)] transition-transform group-hover:translate-x-0.5">
        {t('choose.enter')} <LuArrowRight size={16} />
      </span>
    </button>
  );

  return (
    <div className="login-stage safe-top safe-bottom relative isolate flex min-h-full flex-col text-white">
      <Backdrop />
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <LanguageSelect dark />
      </div>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center px-5 pt-2 pb-10 text-center sm:px-8">
        <p className="login-rise text-[15px] font-semibold text-white/75" style={{ '--d': '.05s' }}>{t('choose.hello', { name })}</p>
        <h1 className="login-rise login-title mt-2 font-display text-[clamp(28px,8vw,40px)] leading-[1.08] font-bold tracking-tight" style={{ '--d': '.15s' }}>
          {t('choose.question')}
        </h1>

        <div className="mt-8 grid w-full max-w-[400px] grid-cols-1 gap-4 sm:max-w-none sm:grid-cols-2 sm:gap-5">
          <Card k="home" tone="home" icon={LuHouse} delay=".3s" title={t('space.home')}
            desc={partner ? t('choose.home_desc', { partner }) : t('choose.home_desc_solo')} />
          <Card k="me" tone="me" icon={LuUserRound} delay=".42s" title={t('choose.me_title')} desc={t('choose.me_desc')}
            badge={<span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase"><LuLock size={12} /> {t('choose.private')}</span>} />
        </div>

        <p className="login-rise mt-6 max-w-[34ch] text-xs leading-relaxed text-white/65 text-balance" style={{ '--d': '.55s' }}>{t('choose.hint')}</p>
        <button type="button" onClick={onSignOut} className="login-rise mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 underline-offset-4 hover:underline" style={{ '--d': '.6s' }}>
          <LuLogOut size={14} /> {t('set.sign_out')}
        </button>
      </main>
    </div>
  );
}
