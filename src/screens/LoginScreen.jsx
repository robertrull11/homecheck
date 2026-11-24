import { useState } from 'react';
import { LuMail, LuLock, LuEye, LuEyeOff, LuSparkles } from 'react-icons/lu';
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
};

export function LoginScreen({ store, externalError }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const demo = store.mode === 'demo';

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

  async function enterDemo() {
    setBusy(true);
    try { await store.signIn('robert@ejemplo.com'); } finally { setBusy(false); }
  }

  const shownError = error || (externalError ? ERROR_KEYS[externalError] || 'common.error' : null);

  return (
    <div className="safe-top flex min-h-full flex-col bg-paper">
      <div className="flex justify-end px-5 pt-4">
        <LanguageSelect />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-16">
        <img src="./icons/icon-192.png" alt="" className="mb-5 h-16 w-16 rounded-2xl shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <h1 className="text-3xl font-extrabold tracking-tight">{t('app.title')}</h1>
        <p className="mt-2 text-muted">{t('login.subtitle')}</p>

        {demo ? (
          <div className="mt-8">
            <button className="btn btn-primary w-full py-3.5 text-base" onClick={enterDemo} disabled={busy}>
              <LuSparkles size={18} /> {t('login.demo_button')}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-muted">{t('login.demo_note')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">{t('login.email')}</label>
              <div className="relative">
                <LuMail className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={18} />
                <input id="email" type="email" autoComplete="username" inputMode="email" className="field pl-10"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">{t('login.password')}</label>
              <div className="relative">
                <LuLock className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" size={18} />
                <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="field pr-11 pl-10"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-muted" aria-label="show password">
                  {show ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                </button>
              </div>
            </div>
            {shownError && <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{t(shownError)}</p>}
            {info && <p className="rounded-xl bg-brand-soft px-3 py-2.5 text-sm text-brand">{t(info)}</p>}
            <button type="submit" className="btn btn-primary w-full py-3.5 text-base" disabled={busy}>
              {busy ? t('login.signing_in') : t('login.sign_in')}
            </button>
            <button type="button" onClick={forgot} className="w-full py-1 text-sm font-medium text-brand">{t('login.forgot')}</button>
            <p className="pt-2 text-center text-xs text-muted">{t('login.private')}</p>
          </form>
        )}
      </div>
    </div>
  );
}
