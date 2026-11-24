// Fechas como texto 'YYYY-MM-DD' en hora local (sin líos de zonas horarias).
const pad = (n) => String(n).padStart(2, '0');

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function makeDate(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

export function addMonths(y, m, n) {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function periodKey(y, m) {
  return `${y}-${pad(m)}`;
}

export function dayDiff(a, b) {
  const pa = parseDate(a), pb = parseDate(b);
  return Math.round((Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / 86400000);
}

export function quarterOf(m) {
  return Math.floor((m - 1) / 3) + 1;
}

export function monthName(locale, m, style = 'long') {
  const s = new Intl.DateTimeFormat(locale, { month: style }).format(new Date(2024, m - 1, 15));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDayHeader(locale, dateStr) {
  const { y, m, d } = parseDate(dateStr);
  const s = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortDate(locale, dateStr) {
  const { y, m, d } = parseDate(dateStr);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}
