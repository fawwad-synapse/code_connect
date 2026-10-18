import { AlertTriangle, ArrowUp, Clock3, CircleCheck } from "lucide-react";
import { getRiskCopy, UI_COPY } from "@/lib/ui-copy";

const riskStyles = {
  critical: { Icon: AlertTriangle, color: "border-rose-700 bg-rose-950 text-rose-200" },
  high: { Icon: ArrowUp, color: "border-orange-700 bg-orange-950 text-orange-200" },
  medium: { Icon: Clock3, color: "border-amber-700 bg-amber-950 text-amber-100" },
  low: { Icon: CircleCheck, color: "border-emerald-700 bg-emerald-950 text-emerald-200" },
};

export function RiskBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  const risk = getRiskCopy(score);
  const { Icon, color } = riskStyles[risk.icon];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${color}`}
      title={`${risk.label}. ${UI_COPY.terms.helpPriorityHelp}`}
      aria-label={`${risk.label}. ${UI_COPY.terms.helpPriority}: ${Math.round(score)}.`}
    >
      <Icon aria-hidden="true" className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {risk.label}
    </span>
  );
}
