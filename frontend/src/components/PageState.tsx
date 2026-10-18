import { AlertCircle, CheckCircle2, CloudOff, Inbox, LoaderCircle } from "lucide-react";
import { ReactNode } from "react";
import { UI_COPY } from "@/lib/ui-copy";

type StateKind = "loading" | "error" | "empty" | "offline" | "success";

const stateIcons = {
  loading: LoaderCircle,
  error: AlertCircle,
  empty: Inbox,
  offline: CloudOff,
  success: CheckCircle2,
};

export function PageState({
  kind,
  title,
  message,
  onRetry,
  retryLabel = UI_COPY.status.retry,
  children,
}: {
  kind: StateKind;
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}) {
  const Icon = stateIcons[kind];
  const role = kind === "error" ? "alert" : "status";
  const color = kind === "error" ? "text-rose-200" : kind === "offline" ? "text-amber-100" : "text-slate-100";
  return (
    <div role={role} aria-live={kind === "error" ? "assertive" : "polite"} className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-center">
      <Icon aria-hidden="true" className={`mx-auto mb-2 h-6 w-6 ${color} ${kind === "loading" ? "animate-spin" : ""}`} />
      <h3 className={`text-base font-semibold ${color}`}>{title}</h3>
      {message && <p className="mx-auto mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">{message}</p>}
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-slate-500 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
