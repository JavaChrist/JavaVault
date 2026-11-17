// Modale accessible : titre + fermeture visibles, contenu défilant, focus piégé,
// Échap pour fermer, restitution du focus à l'élément précédemment actif.

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Désactive la fermeture par Échap / clic extérieur (ex. opération en cours). */
  dismissible?: boolean;
  maxWidth?: number;
}

const FOCUSABLE =
  'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  onClose,
  children,
  footer,
  dismissible = true,
  maxWidth,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    // Focus initial sur le premier élément focalisable, sinon le dialogue.
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    return () => {
      previousFocus.current?.focus?.();
    };
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose],
  );

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <div className="spacer" />
          {dismissible && (
            <button
              type="button"
              className="btn-ghost btn-icon"
              aria-label="Fermer"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
