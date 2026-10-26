/**
 * src/components/member/ConfirmSheet.tsx
 * Small riso confirm dialog (portal, focus moves in, Esc cancels).
 */
import { useEffect, useRef } from 'react';
import { Btn, FixedPortal } from './ui';

export default function ConfirmSheet({
  open, title, text, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, busy, onConfirm, onCancel,
}: {
  open: boolean; title: string; text?: string; confirmLabel?: string; cancelLabel?: string;
  danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <FixedPortal>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(20,18,58,.55)', display: 'grid', alignItems: 'end', justifyItems: 'center' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(100%,430px)', background: 'var(--paper)', borderRadius: '28px 28px 0 0', padding: '24px 20px calc(24px + env(safe-area-inset-bottom))' }}
        >
          <h2 className="h3" style={{ fontSize: 22 }}>{title}</h2>
          {text && <p className="muted" style={{ marginTop: 8 }}>{text}</p>}
          <div className="stack" ref={ref} style={{ marginTop: 20 }}>
            <Btn tone={danger ? 'blue' : 'ink'} block loading={busy} onClick={onConfirm}>{confirmLabel}</Btn>
            <Btn tone="line" block onClick={onCancel}>{cancelLabel}</Btn>
          </div>
        </div>
      </div>
    </FixedPortal>
  );
}
