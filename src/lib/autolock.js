// Cierre de sesión automático tras un tiempo sin usar la app (se guarda en cada dispositivo).
const KEY = 'casa-autolock';
const LAST = 'casa-last-active';
export const AUTOLOCK_OPTIONS = [15, 30, 60, 240, 0]; // minutos; 0 = nunca
const DEFAULT = 30;

export function getAutoLock() {
  try { const v = localStorage.getItem(KEY); return v === null ? DEFAULT : Number(v); } catch { return DEFAULT; }
}
export function setAutoLock(min) { try { localStorage.setItem(KEY, String(min)); } catch { /* sin almacenamiento */ } }
export function touchActivity() { try { localStorage.setItem(LAST, String(Date.now())); } catch { /* sin almacenamiento */ } }
export function isExpired() {
  const min = getAutoLock();
  if (!min) return false;
  try {
    const last = Number(localStorage.getItem(LAST) || 0);
    const expired = last > 0 && Date.now() - last > min * 60 * 1000;
    // Una vez detectado, se olvida: así el siguiente inicio de sesión no se rechaza otra vez.
    if (expired) localStorage.removeItem(LAST);
    return expired;
  } catch { return false; }
}
