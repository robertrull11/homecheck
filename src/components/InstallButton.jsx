// Botón «Instalar la app»: en Chrome/Edge instala con un toque; en el resto enseña los pasos.
// La ficha se pinta en <body> (portal) para que no herede las animaciones ni los colores de la pantalla de entrada.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LuDownload, LuShare, LuCircleCheck } from 'react-icons/lu';
import { useI18n } from '../i18n/index.jsx';
import { useInstall } from '../lib/install.js';
import { Sheet } from './ui.jsx';

export function InstallButton({ dark = false, className = '' }) {
  const { t } = useI18n();
  const { installed, canPrompt, platform, prompt } = useInstall();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (installed || done) {
    return dark ? null : (
      <p className={`flex items-center gap-2 text-sm text-[var(--accent-dark)] ${className}`}><LuCircleCheck size={18} /> {t('install.done')}</p>
    );
  }

  async function onClick() {
    if (canPrompt) { if (await prompt()) setDone(true); return; }
    setOpen(true);
  }

  const steps = t(`install.steps_${platform}`).split('\n');
  return (
    <>
      <button type="button" onClick={onClick}
        className={dark
          ? `inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/25 ${className}`
          : `btn btn-primary w-full py-2.5 ${className}`}>
        {platform === 'ios' ? <LuShare size={17} /> : <LuDownload size={17} />}
        {t(platform === 'android' || platform === 'ios' ? 'install.button_phone' : 'install.button_computer')}
      </button>
      {open && createPortal(<div className="text-left text-ink"><Sheet open title={t('install.title')} onClose={() => setOpen(false)}>
        <div className="flex items-center gap-3 pb-3">
          <img src="./icons/icon-192.png" alt="" width="56" height="56" className="rounded-[14px]" />
          <p className="text-sm leading-relaxed text-muted">{t('install.intro')}</p>
        </div>
        <ol className="space-y-2.5 pb-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-snug">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-ghost mb-2 w-full py-2.5" onClick={() => setOpen(false)}>{t('install.ok')}</button>
      </Sheet></div>, document.body)}
    </>
  );
}
