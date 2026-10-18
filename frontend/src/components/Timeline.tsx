"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  ShieldCheck,
  AlertOctagon,
  ArrowRight,
  Truck,
  RotateCw,
  BellRing,
  CheckCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { UI_COPY } from "@/lib/ui-copy";
import { PageState } from "@/components/PageState";
import { useAppStore } from "@/lib/store";

interface ActionItem {
  time_window: string;
  phase: string;
  zone_id: string;
  zone_name: string;
  suggested_action: string;
  target_count: number;
  recommended_assets: string[];
  rationale: string;
}

export function Timeline() {
  const activeHazard = useAppStore((state) => state.activeHazard);
  const [timeline, setTimeline] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "T-6h" | "T-3h" | "T-0h">("ALL");

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.getTimeline(activeHazard);
      setTimeline(res.timeline || []);
    } catch (err: any) {
      console.error("Failed to load timeline:", err);
      setLoadError(true);
      toast.error("Could not fetch pre-positioning timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  // Hazard selection is the only external refetch trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHazard]);

  const filteredItems = timeline.filter((item) => {
    if (activeTab === "ALL") return true;
    return item.time_window.includes(activeTab);
  });

  const getWindowBadge = (windowStr: string) => {
    if (windowStr.includes("T-6h")) {
      return (
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {UI_COPY.preparation.sixHours}
        </span>
      );
    } else if (windowStr.includes("T-3h")) {
      return (
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
          <BellRing className="w-3.5 h-3.5" />
          {UI_COPY.preparation.threeHours}
        </span>
      );
    } else {
      return (
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
          <AlertOctagon className="w-3.5 h-3.5" />
          {UI_COPY.preparation.now}
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-400" />
            {UI_COPY.pages.preparationTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {UI_COPY.pages.preparationDescription}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchTimeline()}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Timeline
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {(["ALL", "T-6h", "T-3h", "T-0h"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === tab
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {tab === "ALL" ? "All Phases" : tab}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      {loading && timeline.length === 0 ? (
        <PageState kind="loading" title={UI_COPY.status.loading} />
      ) : loadError && timeline.length === 0 ? (
        <PageState kind="error" title={UI_COPY.status.timelineError} onRetry={() => void fetchTimeline()} />
      ) : filteredItems.length === 0 ? (
        <PageState kind="empty" title={UI_COPY.status.timelineEmpty} />
      ) : <div className="space-y-4">
        {filteredItems.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition p-5 rounded-2xl flex flex-col md:flex-row gap-5"
          >
            {/* Left timeline indicator */}
            <div className="flex flex-col items-start gap-2 md:w-60 flex-shrink-0">
              {getWindowBadge(item.time_window)}
              <span className="text-xs font-bold text-slate-200 mt-1">{item.zone_name}</span>
              <span className="text-[11px] text-slate-500 font-mono">Zone ID: {item.zone_id}</span>
              <div className="text-[11px] text-slate-400 mt-2">
              {UI_COPY.preparation.households}: <strong className="text-white">{item.target_count}</strong>
              </div>
            </div>

            {/* Right details */}
            <div className="flex-1 space-y-3">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                {item.suggested_action}
              </div>

              <div className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-slate-300 leading-relaxed">
                <strong className="text-blue-300">{UI_COPY.preparation.why}</strong> {item.rationale}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  {UI_COPY.preparation.suggested}
                </span>
                {item.recommended_assets.map((asset, aidx) => (
                  <span
                    key={aidx}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700"
                  >
                    {asset}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
