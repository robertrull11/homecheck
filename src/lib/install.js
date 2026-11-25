// Instalar la app (icono en la pantalla de inicio del móvil o acceso directo en el ordenador).
// Chrome y Edge (Android, Windows, Mac) avisan con «beforeinstallprompt» y dejan instalar con un toque.
// Safari (iPhone y Mac) y Firefox no: ahí se explican los pasos.
import { useEffect, useState } from 'react';

let deferred = null;
let justInstalled = false;
const subs = new Set();
const notify = () => subs.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; justInstalled = true; notify(); });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// ios · android · mac-safari · firefox · desktop (Chrome, Edge y demás)
export function installPlatform() {
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'mac-safari';
  return 'desktop';
}

export function useInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return {
    installed: isStandalone() || justInstalled,
    canPrompt: !!deferred,
    platform: installPlatform(),
    async prompt() {
      if (!deferred) return false;
      const e = deferred;
      deferred = null;
      e.prompt();
      const choice = await e.userChoice.catch(() => null);
      notify();
      return choice?.outcome === 'accepted';
    },
  };
}
