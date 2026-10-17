"use client";

import React, { useState } from "react";
import { Search, Filter, ShieldAlert, HeartPulse, User, HelpCircle, ChevronRight } from "lucide-react";
import { PriorityItem } from "@/lib/api";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { useAppStore } from "@/lib/store";

interface Props {
  priorities: PriorityItem[];
  onSelectPriority: (item: PriorityItem) => void;
  selectedId?: string;
}

export function PriorityList({ priorities, onSelectPriority, selectedId }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const { activeFilters, setFilter, resetFilters } = useAppStore();

  const filtered = priorities.filter((p) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = p.id.toLowerCase().includes(term);
      const matchZone = p.zone_name.toLowerCase().includes(term);
      if (!matchId && !matchZone) return false;
    }
    if (activeFilters.zoneId && p.zone_id !== activeFilters.zoneId) return false;
    if (activeFilters.medicalOnly && !p.chronic_medical_need) return false;
    if (activeFilters.aloneOnly && !p.lives_alone) return false;
    if (activeFilters.lowConfidenceOnly && p.confidence_level !== "LOW") return false;
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden shadow-lg">
      {/* Search & Quick Filters Header */}
      <div className="p-3.5 border-b border-slate-800 space-y-2.5 bg-slate-900/90 backdrop-blur">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search priority cases by ID or Zone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-2xs">
          <button
            onClick={() => setFilter("medicalOnly", !activeFilters.medicalOnly)}
            className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 transition ${
              activeFilters.medicalOnly
                ? "bg-rose-500 text-white"
                : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <HeartPulse className="w-3 h-3" />
            Medical Needs Only
          </button>

          <button
            onClick={() => setFilter("aloneOnly", !activeFilters.aloneOnly)}
            className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 transition ${
              activeFilters.aloneOnly
                ? "bg-amber-500 text-slate-950 font-bold"
                : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <User className="w-3 h-3" />
            Living Alone
          </button>

          <button
            onClick={() => setFilter("lowConfidenceOnly", !activeFilters.lowConfidenceOnly)}
            className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 transition ${
              activeFilters.lowConfidenceOnly
                ? "bg-purple-600 text-white"
                : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <HelpCircle className="w-3 h-3" />
            Missing Data (Low Conf)
          </button>

          {(activeFilters.medicalOnly || activeFilters.aloneOnly || activeFilters.lowConfidenceOnly) && (
            <button
              onClick={resetFilters}
              className="text-slate-400 hover:text-rose-400 underline ml-auto text-2xs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Ranked Queue Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1.5">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No priority cases match the current filter criteria.
          </div>
        ) : (
          filtered.map((item, index) => {
            const isSelected = item.id === selectedId;
            return (
              <div
                key={item.id}
                onClick={() => onSelectPriority(item)}
                className={`p-3 rounded-lg cursor-pointer transition flex items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-blue-600/15 border border-blue-500/40"
                    : "hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold font-mono text-sm shadow-sm ${
                      item.priority_score >= 70
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : item.priority_score >= 45
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    }`}
                  >
                    <span>{Math.round(item.priority_score)}</span>
                    <span className="text-3xs uppercase font-normal text-slate-400">Score</span>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-tight">{item.id}</span>
                      <span className="text-2xs text-slate-400 font-medium">({item.zone_name})</span>
                    </div>

                    <div className="flex items-center gap-2 text-2xs text-slate-400">
                      <span>Age: {item.age}</span>
                      {item.chronic_medical_need && (
                        <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                          <HeartPulse className="w-2.5 h-2.5" /> Medical
                        </span>
                      )}
                      {item.lives_alone && <span>• Alone</span>}
                      {item.mobility_impaired && <span>• Immobile</span>}
                    </div>

                    <div className="pt-0.5">
                      <ConfidenceBadge
                        level={item.confidence_level}
                        isSilentZone={item.is_silent_zone}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center text-slate-500">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Summary */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950 text-2xs text-slate-400 flex items-center justify-between">
        <span>Showing {filtered.length} of {priorities.length} total cases</span>
        <span className="text-slate-500 font-mono">Sorted by Explainable Priority Score</span>
      </div>
    </div>
  );
}
