/* eslint-disable react-refresh/only-export-components */
// Confirmation via modale stylée (jamais window.confirm).

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "./Modal";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal
          title={options.title}
          maxWidth={440}
          onClose={() => settle(false)}
          footer={
            <>
              <button type="button" onClick={() => settle(false)}>
                {options.cancelLabel ?? "Annuler"}
              </button>
              <button
                type="button"
                className={options.danger ? "btn-danger" : "btn-primary"}
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? "Confirmer"}
              </button>
            </>
          }
        >
          {options.message && (
            <div style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>
              {options.message}
            </div>
          )}
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé dans <ConfirmProvider>.");
  return ctx;
}
