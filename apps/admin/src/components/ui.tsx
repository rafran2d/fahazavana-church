import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { quotaText, type QuotaView } from '../lib/format';

// ---------- Toast ----------

interface ToastApi {
  show: (message: string, tone?: 'info' | 'error') => void;
}
const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null);
  const timer = useRef<number>();
  const show = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    window.clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 4500 : 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div className={`toast${toast.tone === 'error' ? ' toast--error' : ''}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------- Modal / panneau latéral ----------

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2 className="h2">{title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </>
  );
}

// ---------- Quotas ----------

export function Bar({ ratio, alert, large }: { ratio: number; alert?: boolean; large?: boolean }) {
  return (
    <div className={`bar${alert ? ' alert' : ''}${large ? ' bar--lg' : ''}`}>
      <span style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}

export function QuotaLine({ q }: { q: QuotaView }) {
  return (
    <div className="quota-line">
      <div className="top">
        <span>{q.label}</span>
        <span>{quotaText(q)}</span>
      </div>
      <Bar ratio={q.ratio} alert={q.alert} />
    </div>
  );
}

export function QuotaCard({ q, label }: { q: QuotaView; label?: string }) {
  return (
    <div className="card card-pad kpi">
      <span className="label muted">{label ?? q.label}</span>
      <span className="value">
        {q.used} <small>/ {q.limit}{q.unit ? ` ${q.unit}` : ''}</small>
      </span>
      <Bar ratio={q.ratio} alert={q.alert} />
    </div>
  );
}

export function Status({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'off'; children: ReactNode }) {
  return <span className={`st st--${tone}`}>{children}</span>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner banner--alert">
      <span className="bang">!</span>
      <span className="text" style={{ flex: 1 }}>
        {message}
      </span>
      {onRetry && (
        <button className="btn btn--sm" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}
