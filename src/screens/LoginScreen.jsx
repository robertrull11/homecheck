import { useEffect, useRef, useState } from 'react';
import { LuMail, LuLock, LuEye, LuEyeOff, LuSparkles, LuShieldCheck } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { LanguageSelect } from '../components/LanguageSelect.jsx';

const ERROR_KEYS = {
  'auth/invalid-credential': 'err.invalid_credentials',
  'auth/wrong-password': 'err.invalid_credentials',
  'auth/user-not-found': 'err.invalid_credentials',
  'auth/invalid-login-credentials': 'err.invalid_credentials',
  'auth/too-many-requests': 'err.too_many',
  'auth/network-request-failed': 'err.network',
  'auth/invalid-email': 'err.invalid_email',
  'auth/missing-email': 'err.invalid_email',
  'not-member': 'err.not_member',
  idle: 'err.idle',
};

export const CHOSEN_KEY = 'casa-space-chosen';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const saveData = () => typeof navigator !== 'undefined' && navigator.connection?.saveData;

// Fondo: vídeo en bucle (design/login-bg → scripts/render-login-bg.mjs). Si el usuario pide menos
// movimiento o ahorro de datos, se queda la imagen fija.
export function Backdrop() {
  const [still] = useState(() => reducedMotion() || saveData());
  const ref = useRef(null);
  useEffect(() => { ref.current?.play?.().catch(() => { /* iOS en modo ahorro: queda el póster */ }); }, []);
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[#05262c]" aria-hidden="true">
      {still
        ? <img src="./media/login-bg.jpg" alt="" className="h-full w-full object-cover" />
        : <video ref={ref} className="h-full w-full object-cover" src="./media/login-bg.mp4" poster="./media/login-bg.jpg" autoPlay muted loop playsInline preload="auto" />}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(3,22,26,.72)_0%,rgba(3,22,26,.35)_55%,rgba(3,22,26,.6)_100%)]" />
    </div>
  );
}

export function LoginScreen({ store, externalError }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const demo = store.mode === 'demo';
  useEffect(() => { try { sessionStorage.removeItem(CHOSEN_KEY); } catch { /* sin almacenamiento */ } }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!email.trim() || !password) { setError('err.missing_fields'); return; }
    setBusy(true);
    try { await store.signIn(email, password); }
    catch (err) { setError(ERROR_KEYS[err?.code] || 'common.error'); }
    finally { setBusy(false); }
  }

  async function forgot() {
    setError(null); setInfo(null);
    if (!email.trim()) { setInfo('login.reset_need_email'); return; }
    try { await store.resetPassword(email); setInfo('login.reset_sent'); }
    catch (err) { setError(ERROR_KEYS[err?.code] || 'common.error'); }
  }

  async function enterDemo(who) {
    setBusy(true);
    try { await store.signIn(who); } finally { setBusy(false); }
  }

  const shownError = error || (externalError ? ERROR_KEYS[externalError] || 'common.error' : null);
  const alert = shownError && <p className="rounded-2xl bg-white px-3 py-2.5 text-center text-sm font-medium text-danger" role="alert">{t(shownError)}</p>;

  return (
    <div className="login-stage safe-top safe-bottom relative isolate flex min-h-full flex-col text-white">
      <Backdrop />
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <LanguageSelect dark />
      </div>

      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col items-center justify-center px-5 pt-4 pb-10 text-center sm:px-6">
        <div className="login-logo relative mb-8 flex items-center justify-center">
          <span className="login-halo" aria-hidden="true" />
          <span className="login-halo login-halo-2" aria-hidden="true" />
          <img src="./icons/icon-512.png" alt={t('app.title')} width="88" height="88"
            className="relative h-[clamp(72px,18vw,96px)] w-[clamp(72px,18vw,96px)] rounded-[26%] shadow-[0_12px_40px_rgba(0,0,0,.45)]" />
        </div>

        <h1 className="login-rise login-title font-display text-[clamp(30px,8.5vw,42px)] leading-[1.05] font-bold tracking-tight" style={{ '--d': '.25s' }}>
          {t('app.title')}
        </h1>
        <p className="login-rise mt-3 max-w-[30ch] text-[15px] leading-relaxed text-balance text-white/80 sm:text-base" style={{ '--d': '.4s' }}>
          {t('login.subtitle')}
        </p>

        <div className="login-rise login-glass mt-8 w-full rounded-[28px] p-5 sm:p-6" style={{ '--d': '.55s' }}>
          {demo ? (
            <div className="space-y-2.5">
              {alert}
              <button className="btn w-full bg-white py-3.5 text-base text-[#075a62]" onClick={() => enterDemo('robert@ejemplo.com')} disabled={busy}>
                <LuSparkles size={18} /> {t('login.demo_as', { name: 'Robert' })}
              </button>
              <button className="btn w-full border border-white/30 bg-white/10 py-3.5 text-base text-white" onClick={() => enterDemo('arantxa@ejemplo.com')} disabled={busy}>
                {t('login.demo_as', { name: 'Arantxa' })}
              </button>
              <p className="pt-1 text-xs leading-relaxed text-white/70">{t('login.demo_note')}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-white/80" htmlFor="email">{t('login.email')}</label>
                <div className="relative">
                  <LuMail className="absolute top-1/2 left-3.5 -translate-y-1/2 text-white/60" size={18} />
                  <input id="email" type="email" autoComplete="username" inputMode="email" className="login-field pr-10 pl-10"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-white/80" htmlFor="password">{t('login.password')}</label>
                <div className="relative">
                  <LuLock className="absolute top-1/2 left-3.5 -translate-y-1/2 text-white/60" size={18} />
                  <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="login-field pr-10 pl-10"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-white/70" aria-label={t('login.password')}>
                    {show ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                  </button>
                </div>
              </div>
              {alert}
              {info && <p className="rounded-2xl bg-white/90 px-3 py-2.5 text-sm text-[#075a62]">{t(info)}</p>}
              <button type="submit" className="login-cta btn w-full py-3.5 text-base" disabled={busy}>
                {busy ? t('login.signing_in') : t('login.sign_in')}
              </button>
              <button type="button" onClick={forgot} className="w-full py-1 text-sm font-medium text-white/85 underline-offset-4 hover:underline">{t('login.forgot')}</button>
            </form>
          )}
        </div>

        <p className="login-rise mt-6 flex items-center justify-center gap-1.5 text-xs text-white/65" style={{ '--d': '.7s' }}>
          <LuShieldCheck size={14} /> {t('login.private')}
        </p>
      </main>
    </div>
  );
}
