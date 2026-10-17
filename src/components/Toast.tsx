// Toast.tsx — simple toast notification
import React, { useEffect } from 'react';

export type ToastVariant = 'info' | 'success' | 'error' | 'warning';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, variant = 'info', onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`toast toast--${variant}`}
    >
      <span className="toast__message">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="toast__close"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

// ---- Toast container --------------------------------------------------------
import { useState, useCallback, createContext, useContext } from 'react';

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, message, variant }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" aria-label="Notifications">
        {toasts.map(t => (
          <Toast
            key={t.id}
            message={t.message}
            variant={t.variant}
            onDismiss={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
