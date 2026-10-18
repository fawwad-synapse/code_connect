"use client";

import React, { useEffect, useState } from "react";
import { X, ShieldAlert, BarChart3, HelpCircle, Activity, HeartPulse, Home, Radio, Sparkles } from "lucide-react";
import { PriorityItem, api } from "@/lib/api";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { UI_COPY } from "@/lib/ui-copy";
import { useAppStore } from "@/lib/store";

interface Props {
  item: PriorityItem | null;
  onClose: () => void;
  floodLevelPercent?: number;
}

export function ExplanationPanel({ item, onClose, floodLevelPercent }: Props) {
  const activeHazard = useAppStore((state) => state.activeHazard);
  const [explanation, setExplanation] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [loadingExpl, setLoadingExpl] = useState<boolean>(false);

  useEffect(() => {
    if (!item) return;

    let isMounted = true;
    setLoadingExpl(true);
    setExplanation(item.summary_reason);
    setScore(item.priority_score);

    api.getExplanation(item.id, floodLevelPercent, activeHazard)
      .then((data) => {
        if (isMounted && data.explanation) {
          setExplanation(data.explanation);
        }
        if (isMounted && typeof data.priority_score === "number") setScore(data.priority_score);
      })
      .catch(() => {
        // Fallback to item.summary_reason already set
      })
      .finally(() => {
        if (isMounted) setLoadingExpl(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item, floodLevelPercent, activeHazard]);

  if (!item) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono text-slate-400">{item.id}</span>
            <ConfidenceBadge level={item.confidence_level} score={item.confidence} isSilentZone={item.is_silent_zone} />
          </div>
          <h2 className="text-xl font-bold text-white mt-1">{item.zone_name}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1">
        {/* Priority Score Callout */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold" title={UI_COPY.terms.helpPriorityHelp}>{UI_COPY.terms.helpPriority}</div>
            <div className="text-3xl font-black text-rose-500 mt-0.5">{score ?? item.priority_score}<span className="text-sm text-slate-500"> / 100</span></div>
            <div className="text-xs text-rose-400 mt-1 font-medium">{item.summary_reason}</div>
          </div>
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
        </div>

        {/* Explainability Breakdown (Why this score?) */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Why this household is ranked here
          </h3>

          <div className="space-y-2.5">
            {item.factor_breakdown?.map((factor, idx) => (
              <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-300">{factor.label}</span>
                  <span className="font-mono text-blue-400">{factor.raw_value.toFixed(2)} ({factor.percentage}% weight)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, factor.raw_value * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Natural Language Rationale */}
        <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Why help may be needed:</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {loadingExpl ? UI_COPY.status.loading : explanation}
          </p>
        </div>

        {/* Demographics & Household Indicators */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-200">Household support needs</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-2xs">Age</span>
              <span className="font-semibold text-white">{item.age} years old</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-2xs">Lives Alone</span>
              <span className="font-semibold text-white">{item.lives_alone ? "Yes (Isolated)" : "No"}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-2xs">Mobility Status</span>
              <span className="font-semibold text-white">{item.mobility_impaired ? "Impaired (Cannot Walk)" : "Mobile"}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-2xs">Medical Need</span>
              <span className="font-semibold text-white">{item.chronic_medical_need ? "Chronic Dependency" : "Standard"}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-2xs">Home and floor</span>
              <span className="font-semibold text-white capitalize">{item.housing_type} (Floor {item.floor_level})</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-2xs" title={UI_COPY.terms.peopleNotReachedHelp}>Warning contact</span>
              <span className="font-semibold text-white">{item.has_smartphone ? `Smartphone (${Math.round(item.signal_quality * 100)}% signal)` : "No Smartphone (SMS/Manual)"}</span>
            </div>
          </div>
        </div>

        {/* Conservative Assumptions Notice (Incomplete Data) */}
        {item.missing_fields && item.missing_fields.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>Some details are missing; using a cautious estimate</span>
            </div>
            <p className="text-2xs text-slate-400 leading-relaxed">
              Missing details: <span className="text-amber-300 font-mono">{item.missing_fields.join(", ")}</span>.
              The estimate is cautious so people who may need help are not overlooked.
            </p>
          </div>
        )}
      </div>

      {/* Footer Dispatch Actions */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 sticky bottom-0 flex items-center gap-3">
        <a
          href="/resources"
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2.5 rounded-lg text-center transition"
        >
          Choose a team on the Rescue Teams page
        </a>
      </div>
    </div>
  );
}
