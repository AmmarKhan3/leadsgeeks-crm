"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-h">
          <h3>{title}</h3>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon n="x" />
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer ? <div className="modal-f">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** A form inside a modal: children are the fields, the footer has Cancel + submit. */
export function ModalForm({ title, onClose, action, submitLabel, busy, children, wide }: { title: string; onClose: () => void; action: (fd: FormData) => void; submitLabel: React.ReactNode; busy?: boolean; children: React.ReactNode; wide?: boolean }) {
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form action={action} className="stack" style={{ gap: 14 }} id="modal-form">
        {children}
        <div className="modal-f" style={{ margin: "6px -20px -20px", borderTop: "1px solid var(--line)" }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
