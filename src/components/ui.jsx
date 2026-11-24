import { useEffect } from 'react';
import { LuX } from 'react-icons/lu';
import { categoryMeta } from '../lib/categories.js';

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
      <div className="anim-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="-mr-2 rounded-full p-2 text-muted hover:bg-black/5" aria-label="close"><LuX size={22} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line bg-paper px-5 pt-3 pb-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, text, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="alertdialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="anim-fade relative w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
        <p className="text-[15px] leading-relaxed">{text}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'bg-danger text-white' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex rounded-xl bg-black/5 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${value === o.value ? 'bg-card shadow-sm' : 'text-muted'}`}
          style={value === o.value && o.color ? { color: o.color } : undefined}
        >
          {o.label}
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
      <span className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-black/15'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </label>
  );
}

export function CategoryIcon({ type, category, size = 40 }) {
  const meta = categoryMeta(type, category);
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${meta.color} 14%, white)`, color: meta.color }}
    >
      <Icon size={size * 0.48} />
    </span>
  );
}

export function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.06]">
      <div className="h-full rounded-full transition-all" style={{ width: `${max > 0 ? pct : 0}%`, background: over ? 'var(--color-danger)' : color }} />
    </div>
  );
}

export function Toast({ message, action, onAction }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="anim-fade pointer-events-auto flex items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
        <span>{message}</span>
        {action && <button className="font-semibold text-[#8fe3cf]" onClick={onAction}>{action}</button>}
      </div>
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
    <div className="mt-6 mb-2 flex items-center justify-between px-1">
      <h3 className="text-xs font-bold tracking-wide text-muted uppercase">{children}</h3>
      {right}
    </div>
  );
}
