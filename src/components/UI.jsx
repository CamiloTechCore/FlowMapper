import { useEffect, useId, useRef } from 'react';
import { useToastProvider } from '../hooks/useToast';

// ── TOAST CONTAINER ──────────────────────────────────────────────
export function ToastContainer() {
  const { toasts } = useToastProvider();
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : t.type === 'warn' ? '⚠' : '●'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── MODAL ────────────────────────────────────────────────────────
export function Modal({ title, children, onClose, wide }) {
  const modalRef = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const modal = modalRef.current;
    const selector = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]';
    modal.querySelector('[autofocus],input,select,button')?.focus();
    function handleKey(event) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll(selector)];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, []);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal glass-heavy ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-header">
          <span className="modal-title" id={titleId}>{title}</span>
          <button className="btn-icon" aria-label="Cerrar diálogo" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── SPINNER ──────────────────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}

export function LoadingScreen({ label = 'Cargando...' }) {
  return (
    <div className="loading-screen">
      <Spinner size={32} />
      <span className="loading-label">{label}</span>
    </div>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────
export function Empty({ icon = '📭', title, sub, action }) {
  return (
    <div className="empty slide-up">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {sub    && <div className="empty-sub">{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ── BADGE ────────────────────────────────────────────────────────
export function Badge({ children, variant = 'gray', dot }) {
  const dotClass = { activo:'dot-green', borrador:'dot-amber', inactivo:'dot-red' }[dot] || '';
  return (
    <span className={`badge badge-${variant}`}>
      {dot && <span className={`dot ${dotClass}`} />}
      {children}
    </span>
  );
}

// ── STAT CARD ────────────────────────────────────────────────────
export function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card glass-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ── CONFIRM DIALOG ───────────────────────────────────────────────
export function Confirm({ title, message, onConfirm, onCancel, danger }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 4 }}>{message}</p>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirmar</button>
      </div>
    </Modal>
  );
}

// ── SECTION HEADER ───────────────────────────────────────────────
export function SectionHeader({ label }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text-3)', marginBottom: 8 }}>
      {label}
    </div>
  );
}
