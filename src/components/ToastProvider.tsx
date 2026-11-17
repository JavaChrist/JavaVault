/* eslint-disable react-refresh/only-export-components */
// Retours brefs en ligne (ex. « Copié »). Jamais d'alert() natif.

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastApi {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-stack" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>.");
  return ctx;
}
