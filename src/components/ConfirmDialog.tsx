// ConfirmDialog.tsx — modal confirmation dialog (portal, always above drawers)
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  disabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel when opened (safe default for a destructive dialog)
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Escape closes the dialog (unless an action is running)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, disabled, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  const buttonBase: React.CSSProperties = {
    flex: 1,
    minHeight: 48,
    padding: '0 20px',
    borderRadius: 999,
    border: 0,
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };

  return createPortal(
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      // Inline styles on purpose: they do not depend on any CSS file, so the dialog
      // always covers the screen and always sits above the drawer (z-index 200).
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(20, 18, 58, 0.55)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="dialog"
        style={{
          width: '100%',
          maxWidth: 400,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          color: '#14123A',
          borderRadius: 24,
          padding: '1.5rem',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
        }}
      >
        <h2
          id="dialog-title"
          className="dialog__title"
          style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.75rem' }}
        >
          {title}
        </h2>
        <div
          className="dialog__body"
          style={{ fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 1.25rem' }}
        >
          {description}
        </div>
        <div className="dialog__actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="btn btn--ghost"
            style={{ ...buttonBase, background: '#ECEEF8', color: '#14123A' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className={`btn ${isDanger ? 'btn--danger' : 'btn--primary'}`}
            style={{
              ...buttonBase,
              background: isDanger ? '#B8135A' : '#14123A',
              color: '#fff',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}