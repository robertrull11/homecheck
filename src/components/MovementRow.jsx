import { useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useData } from '../data.jsx';
import { CatIcon } from './ui.jsx';
import { formatShortDate } from '../lib/dates.js';

const ACTIONS_W = 144;

// Fila de movimiento. Deslizar a la izquierda muestra Editar y Borrar; tocarla abre la ficha.
export function MovementRow({ tx, onEdit, onDelete, showDate = false }) {
  const { t, money, locale } = useI18n();
  const { categoryOf, memberName, kind } = useData();
  const [offset, setOffset] = useState(0);
  const drag = useRef(null);
  const suppress = useRef(false);
  const cat = categoryOf(tx.type, tx.category);
  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : tx.amount >= 0 ? '→ ' : '← ';
  const color = tx.type === 'income' ? 'text-income' : tx.type === 'saving' ? 'text-saving' : 'text-ink';
  const who = kind === 'home' ? ` · ${memberName(tx.createdBy)}` : '';

  const onPointerDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, start: offset, moved: false }; };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 8) return;
    if (!d.moved && Math.abs(e.clientY - d.y) > Math.abs(dx)) { drag.current = null; return; }
    d.moved = true;
    setOffset(Math.max(-ACTIONS_W, Math.min(0, d.start + dx)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) { suppress.current = true; setOffset((o) => (o < -ACTIONS_W / 2 ? -ACTIONS_W : 0)); }
  };
  const onClick = () => {
    if (suppress.current) { suppress.current = false; return; } // el arrastre no cuenta como toque
    if (offset !== 0) { setOffset(0); return; }
    onEdit(tx);
  };

  return (
    <div className="relative overflow-hidden">
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_W }} aria-hidden={offset === 0}>
          <button tabIndex={offset === 0 ? -1 : 0} className="flex-1 bg-[var(--accent)] text-xs font-semibold text-white" onClick={() => { setOffset(0); onEdit(tx); }}>{t('common.edit')}</button>
          <button tabIndex={offset === 0 ? -1 : 0} className="flex-1 bg-danger text-xs font-semibold text-white" onClick={() => { setOffset(0); onDelete(tx); }}>{t('common.delete')}</button>
        </div>
      )}
      <button
        onClick={onClick}
        onPointerDown={onDelete ? onPointerDown : undefined}
        onPointerMove={onDelete ? onPointerMove : undefined}
        onPointerUp={onDelete ? onPointerUp : undefined}
        onPointerCancel={onDelete ? onPointerUp : undefined}
        style={{ transform: `translateX(${offset}px)`, transition: drag.current ? 'none' : 'transform .18s ease-out', touchAction: 'pan-y' }}
        className="relative flex w-full items-center gap-3 bg-white px-4 py-3 text-left"
      >
        <CatIcon label={cat.label} color={cat.color} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{tx.concept}</span>
            {tx.templateId && <span className="shrink-0 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-dark)]">{t('mov.fixed_badge')}</span>}
          </span>
          <span className="block truncate text-xs text-muted">
            {showDate ? `${formatShortDate(locale, tx.date)} · ` : ''}{cat.label}{who}
          </span>
        </span>
        <span className={`tabular shrink-0 font-bold ${color}`}>{sign}{money(Math.abs(tx.amount))}</span>
      </button>
    </div>
  );
}
