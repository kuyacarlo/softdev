import { useEffect, useRef, type ReactNode } from 'react';
import { ApiError, type ReservationStatus } from '../api';
import { STATUS_LABEL } from '../format';

export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError || error instanceof Error ? error.message : String(error);
  return (
    <div className="alert error" role="alert">
      <p>{message}</p>
    </div>
  );
}

export function Alert({ kind, children }: { kind: 'ok' | 'warn' | 'info' | 'error'; children: ReactNode }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="row muted" aria-live="polite">
      <div className="spinner" /> {label}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
    </label>
  );
}

/** Native <dialog> modal. */
export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose}>
      {open && children}
    </dialog>
  );
}
