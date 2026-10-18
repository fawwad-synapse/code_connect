"use client";

import React, { useState } from "react";
import { Play, FastForward, Copy, WifiOff, HelpCircle, Scale, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { UI_COPY } from "@/lib/ui-copy";

interface Props {
  onScenarioRun?: (scenario: string, result: any) => void;
}

export function SimulatorToolbar({ onScenarioRun }: Props) {
  const [running, setRunning] = useState<string | null>(null);
  const { setActiveScenario } = useAppStore();

  const handleRun = async (scenario: string, label: string) => {
    try {
      setRunning(scenario);
      setActiveScenario(scenario);
      toast.info(`Executing demo trigger: ${label}...`);
      const res = await api.runScenario(scenario);
      toast.success(`Scenario completed: ${res.message || "Updated"}`);
      if (onScenarioRun) {
        onScenarioRun(scenario, res);
      }
    } catch (e: any) {
      toast.error(`Scenario failed: ${e.message || "Error"}`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
        <Play className="w-4 h-4 text-blue-500 fill-blue-500" />
        <span>{UI_COPY.simulator.heading}</span>
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">SIMULATED</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleRun("advance_forecast_3h", "Advance Forecast +3h")}
          disabled={running !== null}
          className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition disabled:opacity-50"
        >
          {running === "advance_forecast_3h" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FastForward className="w-3.5 h-3.5 text-blue-400" />}
          {UI_COPY.simulator.advance}
        </button>

        <button
          onClick={() => handleRun("inject_duplicates", "Inject Duplicate Reports")}
          disabled={running !== null}
          className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition disabled:opacity-50"
        >
          {running === "inject_duplicates" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
          {UI_COPY.simulator.duplicates}
        </button>

        <button
          onClick={() => handleRun("cut_connectivity", "Cut Connectivity")}
          disabled={running !== null}
          className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition disabled:opacity-50"
        >
          {running === "cut_connectivity" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
          {UI_COPY.simulator.lostSignal}
        </button>

        <button
          onClick={() => handleRun("silent_zone", "Trigger Silent Zone")}
          disabled={running !== null}
          className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition disabled:opacity-50"
        >
          {running === "silent_zone" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HelpCircle className="w-3.5 h-3.5 text-purple-400" />}
          {UI_COPY.simulator.fewReports}
        </button>

        <button
          onClick={() => handleRun("resource_conflict", "Resource Conflict")}
          disabled={running !== null}
          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition disabled:opacity-50"
        >
          {running === "resource_conflict" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5 text-emerald-400" />}
          {UI_COPY.simulator.teamShortage}
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[9px] text-amber-200">SIMULATED</span>
        </button>
      </div>
    </div>
  );
}
