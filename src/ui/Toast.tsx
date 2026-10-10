import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import "./Toast.scss";

export type ToastTone = "ok" | "error" | "info";

export interface ToastOptions {
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  /** How long it stays up (default 4 s; 6 s for errors and toasts with an action). */
  durationMs?: number;
}

interface ToastApi {
  show: (message: string, opts?: ToastOptions) => void;
}

interface ActiveToast extends ToastOptions {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<ToastApi | null>(null);
const NO_TOASTS: ToastApi = { show: () => undefined };

/**
 * In-house toasts (replacing alert() in redesigned flows): one at a time, a new one replaces the last.
 * Success and info are announced politely (role="status"), errors at once (role="alert"). The live regions are always
 * on the page, so screen readers pick up what appears in them.
 */
export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, opts: ToastOptions = {}) => {
    nextId.current += 1;
    setToast({ ...opts, id: nextId.current, message, tone: opts.tone ?? "ok" });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const lingers = toast.tone === "error" || Boolean(toast.actionLabel);
    const timer = window.setTimeout(dismiss, toast.durationMs ?? (lingers ? 6000 : 4000));
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  const api = useMemo(() => ({ show }), [show]);
  const urgent = toast?.tone === "error";

  const card = toast ? (
    <div key={toast.id} className={`ui-toast ui-toast--${toast.tone}`}>
      {toast.tone !== "info" ? <Icon name={toast.tone === "ok" ? "check" : "alert"} size={18} className="ui-toast__icon" /> : null}
      <p className="ui-toast__message">{toast.message}</p>
      {toast.actionLabel ? (
        <button
          type="button"
          className="ui-toast__action"
          onClick={() => {
            toast.onAction?.();
            dismiss();
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toasts">
        <div role="status" aria-live="polite" className="ui-toasts__region">
          {urgent ? null : card}
        </div>
        <div role="alert" aria-live="assertive" className="ui-toasts__region">
          {urgent ? card : null}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

/** Show a toast: `useToast().show("Score saved.", { tone: "ok" })`. Outside a ToastProvider it does nothing. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NO_TOASTS;
}

export default ToastProvider;
