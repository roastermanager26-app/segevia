import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button, Icon } from "./ui";

type NoticeTone = "success" | "error";
type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: NoticeTone;
};
type ConfirmState = ConfirmOptions & { resolve: (accepted: boolean) => void };
type FeedbackContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, tone?: NoticeTone) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const toneClass: Record<NoticeTone, string> = {
  success: "border-[#0f5c52] bg-[#d5f4eb] text-[#0b4a42]",
  error: "border-[#8b1e2d] bg-[#fde7eb] text-[#7a1b2a]",
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<ConfirmState | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const timer = useRef<number | null>(null);

  const notify = useCallback((message: string, tone: NoticeTone = "success") => {
    setNotice({ message, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), 6000);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmation({ ...options, resolve });
      }),
    [],
  );

  const closeConfirmation = (accepted: boolean) => {
    confirmation?.resolve(accepted);
    setConfirmation(null);
  };

  return (
    <FeedbackContext.Provider value={{ confirm, notify }}>
      {children}
      {notice && (
        <div
          className="fixed left-1/2 top-5 z-[110] w-[min(42rem,calc(100%-2rem))] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div
            className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 shadow-lg ${toneClass[notice.tone]}`}
          >
            <Icon
              name={notice.tone === "success" ? "check_circle" : "error"}
              className="mt-0.5 shrink-0"
            />
            <p className="flex-1 text-body-md font-medium">{notice.message}</p>
            <button
              type="button"
              className="rounded p-1 hover:bg-black/5"
              aria-label="Cerrar"
              onClick={() => setNotice(null)}
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
      )}
      {confirmation && (
        <div
          className="fixed inset-0 z-[120] bg-slate-950/30 p-4"
          role="presentation"
          onMouseDown={() => closeConfirmation(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            className={`absolute left-1/2 top-6 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border-2 p-5 shadow-xl ${toneClass[confirmation.tone ?? "success"]}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <Icon name="help" className="mt-0.5" />
              <div className="flex-1">
                <h2 id="confirmation-title" className="font-headline text-headline-sm font-bold">
                  {confirmation.title ?? "Confirmar acción"}
                </h2>
                <p className="mt-2 text-body-md">{confirmation.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => closeConfirmation(false)}>
                Cancelar
              </Button>
              <button
                type="button"
                className={`rounded-lg px-space-md py-2 text-label-md text-white ${
                  confirmation.tone === "error"
                    ? "bg-[#8b1e2d] hover:bg-[#721624]"
                    : "bg-[#0f5c52] hover:bg-[#0b4a42]"
                }`}
                onClick={() => closeConfirmation(true)}
              >
                {confirmation.confirmLabel ?? "Aceptar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback debe usarse dentro de FeedbackProvider.");
  return context;
}
