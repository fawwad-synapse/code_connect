"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Truck,
  Users,
  Layers,
  ArrowRight,
  Filter,
  RefreshCw,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { InteractiveMap } from "@/components/Map";
import { SimulatorToolbar } from "@/components/SimulatorToolbar";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { api, PriorityItem } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

export default function OperationsCenterPage() {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [floodLevel, setFloodLevel] = useState(50);
  const [baselineScores, setBaselineScores] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({
    criticalCases: 0,
    silentZones: 1,
    activeAssets: 12,
    shelterCount: 4,
  });

  const { selectedPriority, setSelectedPriority, mapLayers, toggleLayer } = useAppStore();

  const fetchDashboardData = async (whatIfLevel: number | null = floodLevel) => {
    try {
      setLoading(true);
      const baselineRes = await api.getPriorities({ page_size: 15 });
      setBaselineScores(Object.fromEntries(baselineRes.items.map((item) => [item.id, item.priority_score])));
      const prioRes = whatIfLevel === null
        ? baselineRes
        : await api.getPriorities({ page_size: 15, flood_level_percent: whatIfLevel });
      setPriorities(prioRes.items || []);
      setTotalCount(prioRes.total || 0);

      const highPrio = (prioRes.items || []).filter((p) => p.priority_score >= 60).length;
      setStats((prev) => ({
        ...prev,
        criticalCases: highPrio > 0 ? highPrio : prioRes.total,
      }));
    } catch (err) {
      console.error("Dashboard fetch failed:", err);
      toast.error("Could not load real-time priority telemetry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(50);

    // Setup live WebSocket connection for event broadcast
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/events";
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        console.log("WebSocket connected to EOC event stream");
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventType = String(payload.type || "").toUpperCase();
          if (eventType === "NEW_REPORT") {
            toast.info(`New incident reported: ${payload.data?.address || "Karachi"}`);
            fetchDashboardData();
          } else if (
            ["FLOOD_ALERT", "PRIORITY_UPDATE", "SILENT_ZONE_TRIGGER", "ASSIGNMENT_CHANGE", "ASSIGNMENT_OVERRIDE"].includes(eventType)
          ) {
            toast.success(`Simulator event: ${payload.data?.name || "Updated"}`);
            fetchDashboardData();
          }
        } catch {
          // Ignore parse errors
        }
      };
      socket.onerror = () => {
        // Silent degrade for local test without WS server
      };
    } catch {
      // WS unsupported or offline
    }

    return () => {
      if (socket) socket.close();
    };
  }, []);

  const handleScenarioFinished = () => {
    fetchDashboardData();
  };

  return (
    <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 space-y-5">
      {/* Simulator Toolbar for Live Demo */}
      <SimulatorToolbar onScenarioRun={handleScenarioFinished} />

      <section className="rounded-xl border border-cyan-900/70 bg-slate-900/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">What-if flood level</h2>
            <p className="text-xs text-slate-400">Overrides forecast depth for ranking only; it does not change stored forecasts.</p>
          </div>
          <label htmlFor="flood-level" className="text-sm font-bold text-cyan-300">{floodLevel}%</label>
        </div>
        <input
          id="flood-level"
          type="range"
          min={0}
          max={100}
          step={1}
          value={floodLevel}
          onChange={(event) => {
            const value = Number(event.target.value);
            setFloodLevel(value);
            void fetchDashboardData(value);
          }}
          className="mt-3 w-full accent-cyan-400"
          aria-label="Flood level percentage"
        />
        <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
          {priorities.slice(0, 5).map((item) => {
            const before = baselineScores[item.id];
            const delta = before === undefined ? null : item.priority_score - before;
            return <div key={item.id} className="rounded-md bg-slate-950/70 px-2.5 py-2 text-xs text-slate-300">
              <span className="font-semibold text-white">{item.zone_name}</span>
              <span className="ml-2">{before === undefined ? "—" : before.toFixed(1)} → {item.priority_score.toFixed(1)}</span>
              {delta !== null && <span className={`ml-1 font-bold ${delta >= 0 ? "text-emerald-400" : "text-amber-300"}`}>({delta >= 0 ? "+" : ""}{delta.toFixed(1)})</span>}
            </div>;
          })}
        </div>
      </section>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-semibold uppercase tracking-wider">
            <span>Critical Priorities</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-white">{totalCount} Cases</div>
          <div className="text-xs text-rose-400 mt-1 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Top Triage Cohort (Score &ge; 60)
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-semibold uppercase tracking-wider">
            <span>Silent Zones Flagged</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-amber-400">1 Zone (Malir)</div>
          <div className="text-xs text-slate-400 mt-1 font-medium">
            High Hazard + Zero Reports (Uncertainty Uplift)
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-semibold uppercase tracking-wider">
            <span>Rescue Units</span>
            <Truck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-white">{stats.activeAssets} Ready</div>
          <div className="text-xs text-emerald-400 mt-1 font-medium">
            Boats, Ambulances & 4x4 Evac Units
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-semibold uppercase tracking-wider">
            <span>Emergency Shelters</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-white">{stats.shelterCount} Facilities</div>
          <div className="text-xs text-blue-400 mt-1 font-medium">
            68% Avg Capacity Occupied
          </div>
        </div>
      </div>

      {/* Main Command Center Layout: Map + Live Queue Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[720px]">
        {/* Map Container */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col relative shadow-xl">
          {/* Map Controls Header */}
          <div className="p-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                Karachi Flood Geospatial Layers:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "zones", label: "Flood Zones" },
                  { id: "households", label: "Priorities" },
                  { id: "shelters", label: "Shelters" },
                  { id: "resources", label: "Rescue Units" },
                  { id: "blockedRoads", label: "Road Closures" },
                  { id: "waterways", label: "Waterways" },
                ] as const
              ).map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition ${
                    mapLayers[layer.id]
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div className="flex-1 w-full relative">
            <InteractiveMap floodLevelPercent={floodLevel} />
          </div>
        </div>

        {/* Right Sidebar: Real-Time Priority Ranking Queue */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Top Response Queue
              </h2>
              <p className="text-[11px] text-slate-400">Ranked by Transparent Priority Score</p>
            </div>

            <button
              onClick={() => fetchDashboardData()}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Priority Queue List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-1">
            {priorities.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => setSelectedPriority(item)}
                className={`p-3 rounded-xl cursor-pointer transition ${
                  selectedPriority?.id === item.id
                    ? "bg-blue-950/60 border border-blue-600/50"
                    : "hover:bg-slate-800/60 bg-slate-950/40 border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white">{item.zone_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {item.priority_score.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 line-clamp-1 mb-2">
                  {item.summary_reason}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>Vuln: {(item.vulnerability_index * 100).toFixed(0)}%</span>
                    <span>|</span>
                    <span>Gap: {(item.warning_gap * 100).toFixed(0)}%</span>
                  </div>
                  <ConfidenceBadge
                    level={item.confidence_level}
                    score={item.confidence}
                    isSilentZone={item.is_silent_zone}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Queue Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              Showing top {priorities.length} of {totalCount}
            </span>
            <Link
              href="/priorities"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
            >
              Full Priority Ledger
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Slide-over Explainability Drawer */}
      <ExplanationPanel item={selectedPriority} onClose={() => setSelectedPriority(null)} />
    </main>
  );
}
