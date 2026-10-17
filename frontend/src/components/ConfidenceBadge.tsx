import React from "react";
import { ShieldCheck, AlertCircle, HelpCircle } from "lucide-react";

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
        UNKNOWN / UNCERTAIN
      </span>
    );
  }

  switch (level.toUpperCase()) {
    case "HIGH":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          High Confidence {score !== undefined && `(${Math.round(score * 100)}%)`}
        </span>
      );
    case "MEDIUM":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          Medium Confidence {score !== undefined && `(${Math.round(score * 100)}%)`}
        </span>
      );
    case "LOW":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          Low Confidence (Missing Data) {score !== undefined && `(${Math.round(score * 100)}%)`}
        </span>
      );
  }
}
