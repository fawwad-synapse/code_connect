import React from "react";
import { ShieldCheck, AlertCircle, HelpCircle } from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

interface Props {
  level: "HIGH" | "MEDIUM" | "LOW" | string;
  score?: number;
  isSilentZone?: boolean;
}

export function ConfidenceBadge({ level, score, isSilentZone }: Props) {
  if (isSilentZone) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800 shadow-sm animate-pulse">
        <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
        {UI_COPY.risk.uncertain}
      </span>
    );
  }

  switch (level.toUpperCase()) {
    case "HIGH":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Reliable information {score !== undefined && `(${Math.round(score * 100)}%)`}
        </span>
      );
    case "MEDIUM":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          Some information missing {score !== undefined && `(${Math.round(score * 100)}%)`}
        </span>
      );
    case "LOW":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          {UI_COPY.risk.needsChecking} {score !== undefined && `(${Math.round(score * 100)}%)`}
        </span>
      );
  }
}
