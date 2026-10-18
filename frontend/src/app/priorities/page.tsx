"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Users,
  Search,
  Filter,
  HeartPulse,
  User,
  HelpCircle,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import { api, PriorityItem } from "@/lib/api";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { PageState } from "@/components/PageState";
import { UI_COPY } from "@/lib/ui-copy";

export default function PrioritiesPage() {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM">("ALL");

  const { selectedPriority, setSelectedPriority, activeHazard, activeFilters, setFilter, resetFilters } = useAppStore();

  const fetchPriorities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getPriorities({ page: 1, page_size: 50, hazard: activeHazard });
      setPriorities(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error(err);
      toast.error("Could not fetch people at risk");
    } finally {
      setLoading(false);
    }
  }, [activeHazard]);

  useEffect(() => {
    fetchPriorities();
  }, [fetchPriorities]);

  const filtered = priorities.filter((p) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = p.id.toLowerCase().includes(term);
      const matchZone = p.zone_name.toLowerCase().includes(term);
      if (!matchId && !matchZone) return false;
    }
    if (activeTab === "CRITICAL" && p.priority_score < 70) return false;
    if (activeTab === "HIGH" && (p.priority_score < 45 || p.priority_score >= 70)) return false;
    if (activeTab === "MEDIUM" && (p.priority_score < 25 || p.priority_score >= 45)) return false;
    if (activeFilters.medicalOnly && !p.chronic_medical_need) return false;
    if (activeFilters.aloneOnly && !p.lives_alone) return false;
    if (activeFilters.lowConfidenceOnly && p.confidence_level !== "LOW") return false;
    return true;
  });

  return (
    <div className="flex-1 bg-[#f4f7fb] text-slate-800 p-4 lg:p-6 space-y-5">
      {/* Page Title & Search Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">People at Risk</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify and prioritize vulnerable citizens based on explainable risk scores
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by area or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm transition"
            />
          </div>
          <button
            onClick={fetchPriorities}
            disabled={loading}
            className="p-2 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 rounded-xl transition shadow-sm"
          >
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </header>

      {/* Filter Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              activeTab === "ALL" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            All People ({priorities.length})
          </button>
          <button
            onClick={() => setActiveTab("CRITICAL")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              activeTab === "CRITICAL" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            }`}
          >
            Critical (Score 70+)
          </button>
          <button
            onClick={() => setActiveTab("HIGH")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              activeTab === "HIGH" ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
            }`}
          >
            High Risk (45-69)
          </button>
          <button
            onClick={() => setActiveTab("MEDIUM")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              activeTab === "MEDIUM" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            Medium Risk (25-44)
          </button>
        </div>

        {/* Quick Attribute Badges */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilter("medicalOnly", !activeFilters.medicalOnly)}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeFilters.medicalOnly ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" /> Medical Need
          </button>
          <button
            onClick={() => setFilter("aloneOnly", !activeFilters.aloneOnly)}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeFilters.aloneOnly ? "bg-amber-500 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            <User className="w-3.5 h-3.5" /> Lives Alone
          </button>
          <button
            onClick={() => setFilter("lowConfidenceOnly", !activeFilters.lowConfidenceOnly)}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeFilters.lowConfidenceOnly ? "bg-purple-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" /> Low Data
          </button>
        </div>
      </div>

      {/* People Card List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 divide-y divide-slate-100 overflow-hidden">
        {loading && priorities.length === 0 ? (
          <div className="p-8"><PageState kind="loading" title="Loading people at risk…" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No people found matching filters.</div>
        ) : (
          filtered.map((item, idx) => {
            const isCritical = item.priority_score >= 70;
            const isHigh = item.priority_score >= 45 && item.priority_score < 70;
            const isMedium = item.priority_score >= 25 && item.priority_score < 45;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedPriority(item)}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition ${
                  selectedPriority?.id === item.id ? "bg-blue-50/70 border-l-4 border-l-blue-600" : ""
                }`}
              >
                {/* Person identification */}
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-base shrink-0">
                    {idx % 4 === 0 ? "👵" : idx % 4 === 1 ? "👴" : idx % 4 === 2 ? "👩" : "👨"}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{item.id}</span>
                      <span className="text-xs text-slate-400">• {item.zone_name}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isCritical
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : isHigh
                            ? "bg-orange-50 text-orange-600 border border-orange-200"
                            : isMedium
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {isCritical ? "Critical" : isHigh ? "High" : isMedium ? "Medium" : "Low"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Age {item.age} • {item.housing_type} (Floor {item.floor_level})
                    </p>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      {item.chronic_medical_need && (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <HeartPulse className="w-3 h-3" /> Medical Assistance Needed
                        </span>
                      )}
                      {item.lives_alone && (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <User className="w-3 h-3" /> Lives Alone
                        </span>
                      )}
                      {item.mobility_impaired && (
                        <span className="text-purple-600 font-semibold flex items-center gap-1">
                          Needs Mobility Assistance
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score & View Explanation Action */}
                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Help Priority</span>
                    <span className="text-lg font-black text-slate-900">
                      {item.priority_score.toFixed(1)} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPriority(item);
                    }}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Slide-over Explainability Drawer */}
      <ExplanationPanel item={selectedPriority} onClose={() => setSelectedPriority(null)} />
    </div>
  );
}
