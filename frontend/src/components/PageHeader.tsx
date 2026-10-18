import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";
import { UI_COPY } from "@/lib/ui-copy";

interface PageHeaderProps {
  title: string;
  description: string;
  icon?: ReactNode;
  backHref?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, backHref, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label={UI_COPY.actions.backToOverview}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
        )}
        {icon && <span aria-hidden="true" className="shrink-0 text-blue-300">{icon}</span>}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-300">{description}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
