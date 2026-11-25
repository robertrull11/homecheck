import { useEffect } from 'react';
import { LuX } from 'react-icons/lu';

export function Sheet({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-[#0f2a2e]/40" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[94dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-paper sm:rounded-[28px]">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white" aria-label="close"><LuX size={18} /></button>
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <span className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line bg-paper px-5 pt-3 pb-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, text, confirmLabel, cancelLabel, danger, onConfirm, onCancel, children, confirmDisabled }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="alertdialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-[#0f2a2e]/45" onClick={onCancel} />
      <div className="anim-fade relative w-full max-w-sm rounded-3xl bg-card p-5 shadow-xl">
        <p className="text-[15px] leading-relaxed">{text}</p>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'bg-danger text-white' : 'btn-primary'}`} onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '', size = 'md' }) {
  return (
    <div className={`flex rounded-[14px] bg-tint p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 ${size === 'sm' ? 'py-1.5 text-[13px]' : 'py-2.5 text-sm'} font-semibold transition ${value === o.value ? 'bg-white text-[var(--accent)] shadow-[0_1px_2px_rgba(15,42,46,.12)]' : 'text-muted'}`}
        >
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition peer-focus-visible:outline-2 ${checked ? 'bg-[var(--accent)]' : 'bg-[#0f2a2e]/15'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </label>
  );
}

// Icono de categoría: inicial sobre su color suave.
export function CatIcon({ label = '?', color = '#475569', size = 36 }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center font-bold"
      style={{ width: size, height: size, borderRadius: size * 0.33, background: `color-mix(in srgb, ${color} 13%, white)`, color, fontSize: size * 0.4 }}>
      {(label || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

// Iniciales de quien apuntó el movimiento.
export function Avatar({ name = '', style, size = 30, ring }) {
  return (
    <span title={name} className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: style?.bg, color: style?.fg, fontSize: size * 0.4, border: ring ? '2px solid var(--color-paper)' : undefined }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function ProgressBar({ value, max, color, warn, height = 6 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="w-full overflow-hidden rounded-full bg-hair" style={{ height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? 'var(--color-danger)' : warn ? '#E07B1A' : color }} />
    </div>
  );
}

export function Ring({ pct, size = 84, stroke = 9, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-tint)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-[17px] font-bold">{Math.round(p)} %</span>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4" role="status">
      <div className="anim-fade rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-lg">{message}</div>
    </div>
  );
}

export function Empty({ icon: Icon, text, children }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      {Icon && <Icon size={36} className="text-muted/60" />}
      <p className="max-w-xs text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="mt-6 mb-2 flex items-baseline justify-between px-1">
      <h2 className="text-[15px] font-bold">{children}</h2>
      {right}
    </div>
  );
}
