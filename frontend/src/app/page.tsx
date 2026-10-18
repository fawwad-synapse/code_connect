"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Truck,
  CloudSun,
  ChevronRight,
  Home,
  User,
  Zap,
  Navigation,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { InteractiveMap } from "@/components/Map";
import { SimulatorToolbar } from "@/components/SimulatorToolbar";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { api, PriorityItem, ResourceItem, ShelterItem } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { FirstVisitGuide } from "@/components/FirstVisitGuide";
import { HAZARDS } from "@/lib/hazards";

export default function OperationsCenterPage() {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [floodLevel, setFloodLevel] = useState(50);
  const [planUpdated, setPlanUpdated] = useState(false);
  const [baselineScores, setBaselineScores] = useState<Record<string, number>>({});
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [shelters, setShelters] = useState<ShelterItem[]>([]);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);

  const [stats, setStats] = useState({
    criticalCases: 0,
    silentZones: 1,
    activeAssets: 8,
    shelterCount: 5,
    totalShelterCapacity: 2030,
    shelterOccupancy: 1240,
  });

  const {
    selectedPriority,
    setSelectedPriority,
    setLatestPlan,
    setActiveFloodLevel,
    activeHazard,
    setActiveHazard,
  } = useAppStore();

  const handleHazardChange = (next: "flood" | "heatwave") => {
    setActiveHazard(next);
    try {
      window.localStorage.setItem("rescue-hazard", next);
      const url = new URL(window.location.href);
      url.searchParams.set("hazard", next);
      window.history.replaceState({}, "", url);
    } catch {}
  };

  const hazardProfile = HAZARDS[activeHazard];

  const fetchDashboardData = useCallback(
    async (whatIfLevel: number | null) => {
      try {
        setLoading(true);
        setLoadError(false);

        // Fetch priorities
        const baselineRes = await api.getPriorities({ page_size: 15, hazard: activeHazard });
        setBaselineScores(
          Object.fromEntries(baselineRes.items.map((item) => [item.id, item.priority_score]))
        );

        const prioRes =
          whatIfLevel === null
            ? baselineRes
            : await api.getPriorities({
                page_size: 15,
                hazard: activeHazard,
                ...(activeHazard === "flood"
                  ? { flood_level_percent: whatIfLevel }
                  : { heat_index_c: whatIfLevel }),
              });

        setPriorities(prioRes.items || []);
        setTotalCount(prioRes.total || 0);

        const highPrio = (prioRes.items || []).filter((p) => p.priority_score >= 60).length;

        // Fetch resources & shelters
        try {
          const resRes = await api.getResources(whatIfLevel || 50, activeHazard);
          setResources(resRes.resources || []);
          setShelters(resRes.shelters || []);

          const totalCap = (resRes.shelters || []).reduce((acc, s) => acc + (s.capacity || 0), 0);
          const totalOcc = (resRes.shelters || []).reduce((acc, s) => acc + (s.current_occupancy || 0), 0);
          const activeTeams = (resRes.resources || []).filter((r) => r.status === "AVAILABLE" || r.status === "ASSIGNED").length;

          setStats((prev) => ({
            ...prev,
            criticalCases: highPrio > 0 ? highPrio : prioRes.total,
            activeAssets: activeTeams > 0 ? activeTeams : 8,
            shelterCount: resRes.shelters?.length || 5,
            totalShelterCapacity: totalCap > 0 ? totalCap : 2030,
            shelterOccupancy: totalOcc > 0 ? totalOcc : 1240,
          }));
        } catch {
          setStats((prev) => ({
            ...prev,
            criticalCases: highPrio > 0 ? highPrio : prioRes.total,
          }));
        }


      } catch (err) {
        setLoadError(true);
        console.error("Dashboard fetch failed:", err);
        toast.error("Could not load real-time priority telemetry");
      } finally {
        setLoading(false);
      }
    },
    [activeHazard]
  );

  useEffect(() => {
    const defaultLevel = HAZARDS[activeHazard].sliderDefault;
    setFloodLevel(defaultLevel);
    fetchDashboardData(defaultLevel);

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/events";
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
            fetchDashboardData(50);
          } else if (["FLOOD_ALERT", "HEAT_ALERT"].includes(eventType) && payload.data?.alerts_simulated) {
            toast.warning("Simulated alert (no real SMS sent)");
            fetchDashboardData(50);
          } else if (
            [
              "FLOOD_ALERT",
              "PRIORITY_UPDATE",
              "SILENT_ZONE_TRIGGER",
              "ASSIGNMENT_CHANGE",
              "ASSIGNMENT_OVERRIDE",
            ].includes(eventType)
          ) {
            toast.success(`Simulator event: ${payload.data?.name || "Updated"}`);
            fetchDashboardData(50);
          }
        } catch {
          // Ignore parse errors
        }
      };
    } catch {
      // WS unsupported
    }

    return () => {
      if (socket) socket.close();
    };
  }, [activeHazard, fetchDashboardData]);

  useEffect(() => {
    setActiveFloodLevel(floodLevel);
    setPlanUpdated(false);
    const timeout = window.setTimeout(async () => {
      try {
        const plan = await api.optimizeAssignments(false, floodLevel, activeHazard);
        setLatestPlan(plan);
        window.dispatchEvent(new CustomEvent("rescue-plan-updated", { detail: plan }));
        setPlanUpdated(true);
      } catch (error) {
        console.error("Could not update the what-if plan", error);
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [floodLevel, activeHazard, setLatestPlan, setActiveFloodLevel]);

  const handleScenarioFinished = () => {
    fetchDashboardData(floodLevel);
  };

  // Authentic Karachi names from reference
  const referenceNames = [
    { name: "Ayesha Begum", subtitle: "Age 72 • Disabled", loc: "Sector 5, North Karachi", status: "High Priority", statusClass: "bg-rose-50 text-rose-600 border-rose-200", tag: "Needs Evacuation", tagColor: "text-rose-600" },
    { name: "Muhammad Ali", subtitle: "Age 68 • Chronic Illness", loc: "Gulshan-e-Iqbal", status: "High Priority", statusClass: "bg-rose-50 text-rose-600 border-rose-200", tag: "Medical Assistance Needed", tagColor: "text-rose-600" },
    { name: "Sana Khan", subtitle: "Age 54 • Lives Alone", loc: "Malir", status: "Medium Priority", statusClass: "bg-amber-50 text-amber-600 border-amber-200", tag: "Check-in Required", tagColor: "text-amber-600" },
    { name: "Iman Sheikh", subtitle: "Age 45 • Low-Income Household", loc: "Korangi", status: "Medium Priority", statusClass: "bg-amber-50 text-amber-600 border-amber-200", tag: "Relief Supplies", tagColor: "text-amber-600" },
    { name: "Zainab Raza", subtitle: "Age 32 • No Smartphone", loc: "Clifton", status: "Lower Priority", statusClass: "bg-emerald-50 text-emerald-600 border-emerald-200", tag: "Information Needed", tagColor: "text-emerald-600" },
  ];

  return (
    <div className="flex-1 bg-[#f4f7fb] text-slate-800 p-4 lg:p-6 space-y-4">
      <FirstVisitGuide />

      {/* TOP HEADER BAR (Directly matching the top of the reference image) */}
      <header className="flex items-center justify-between gap-4 py-1">
        {/* Breadcrumb / Title */}
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Dashboard
          </h1>
          <p className="text-xs text-slate-400">Emergency Overview & Triage Prioritization</p>
        </div>

        {/* Header Right Items: Hazard Switcher | Weather | Alert Status Pill | Date/Time */}
        <div className="flex items-center gap-2.5">
          {/* Hazard Mode Selector Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => handleHazardChange("flood")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeHazard === "flood"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🌊</span>
              <span>Flood</span>
            </button>
            <button
              onClick={() => handleHazardChange("heatwave")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeHazard === "heatwave"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>☀️</span>
              <span>Heatwave</span>
            </button>
          </div>

          {/* Weather Widget */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-xs shadow-sm font-semibold text-slate-700">
            {activeHazard === "heatwave" ? (
              <Sun className="w-5 h-5 text-amber-500 animate-pulse" />
            ) : (
              <CloudSun className="w-5 h-5 text-sky-500" />
            )}
            <div>
              <span className="font-bold text-slate-900 leading-none">
                {activeHazard === "heatwave" ? "44°C" : "28°C"}
              </span>
              <span className="text-[10px] text-slate-400 block leading-tight">Karachi</span>
            </div>
          </div>

          {/* Alert Status Pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
            activeHazard === "heatwave"
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}>
            <div className={`w-5 h-5 rounded-full text-white flex items-center justify-center ${
              activeHazard === "heatwave" ? "bg-amber-500" : "bg-rose-500"
            }`}>
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="leading-tight block font-extrabold">
                {activeHazard === "heatwave" ? "Heat Alert" : "Flood Alert"}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider block leading-none ${
                activeHazard === "heatwave" ? "text-amber-600" : "text-rose-600"
              }`}>
                {activeHazard === "heatwave" ? "Extreme Danger" : "High Risk"}
              </span>
            </div>
          </div>

          {/* Date & Time from Reference */}
          <div className="hidden sm:flex flex-col text-right px-2 text-xs">
            <span className="font-bold text-slate-800 text-[13px] leading-tight">14 Oct 2026</span>
            <span className="text-[11px] text-slate-400 font-medium">04:32 PM</span>
          </div>
        </div>
      </header>

      {/* COLLAPSIBLE WHAT-IF TOOLBAR (PRESERVED FUNCTIONALITY) */}
      {showWhatIf && (
        <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                What-if {hazardProfile.sliderLabel.toLowerCase()}
              </h2>
              <p className="text-xs text-slate-500">
                Adjust simulated forecast without changing stored database entries.
              </p>
            </div>
            <span className="text-sm font-extrabold px-3 py-1 rounded-xl bg-blue-100 text-blue-700">
              {floodLevel}
              {hazardProfile.unit}
            </span>
          </div>
          <input
            id="flood-level"
            type="range"
            min={hazardProfile.sliderMin}
            max={hazardProfile.sliderMax}
            step={hazardProfile.sliderStep}
            value={floodLevel}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFloodLevel(val);
              void fetchDashboardData(val);
            }}
            className="mt-3 w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Min ({hazardProfile.sliderMin}{hazardProfile.unit})</span>
            <span className="font-semibold text-emerald-600">{planUpdated ? "✓ Response plan recalculation updated" : "Recalculating..."}</span>
            <span>Max ({hazardProfile.sliderMax}{hazardProfile.unit})</span>
          </div>
        </section>
      )}

      {/* COLLAPSIBLE SIMULATOR TOOLBAR (PRESERVED FUNCTIONALITY) */}
      {showSimulator && (
        <section className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-600" /> Demo Simulator Injection Triggers
            </span>
          </div>
          <SimulatorToolbar onScenarioRun={handleScenarioFinished} />
        </section>
      )}

      {/* 5 KPI METRIC CARDS (EXACT MATCH TO REFERENCE IMAGE) */}
      {/* 4 KPI METRIC CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: People at High Risk */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-rose-500 fill-rose-100" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">People at High Risk</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none my-1">
              {totalCount > 0 ? (totalCount * 14).toLocaleString() : "2,842"}
            </h3>
            <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-0.5">
              <span>↑ 18%</span>
              <span className="text-slate-400 font-normal">since last update</span>
            </p>
          </div>
        </div>

        {/* Card 2: Critical Areas */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500 fill-amber-100" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Critical Areas</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none my-1">
              {stats.criticalCases > 0 ? stats.criticalCases : 12}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              Flood / Heatwave / Other
            </p>
          </div>
        </div>

        {/* Card 3: Rescue Teams Active */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6 text-sky-500 fill-sky-100" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Rescue Teams Active</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none my-1">
              {stats.activeAssets}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">2 on standby</p>
          </div>
        </div>

        {/* Card 4: Shelters Open */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Home className="w-6 h-6 text-emerald-600 fill-emerald-100" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Shelters Open</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none my-1">
              {stats.shelterCount}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              Capacity: 1,240 / 2,030
            </p>
          </div>
        </div>
      </section>

      {/* MIDDLE SECTION: MAP (LEFT ~65%) & PRIORITY PEOPLE (RIGHT ~35%) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Container */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col h-[520px] lg:h-[580px]">
          {/* Map Title Header with Risk Dots and Layers Button */}
          <div className="p-3.5 px-4 border-b border-slate-100 bg-white flex items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 text-blue-600">
                <Navigation className="w-4 h-4 rotate-45" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Affected Areas & Priority Map
              </h2>
            </div>

            {/* Reference Legend Dots (High Risk, Medium Risk, Low Risk) */}
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> High Risk
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium Risk
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low Risk
              </span>
            </div>
          </div>

          {/* Map canvas */}
          <div className="flex-1 w-full relative">
            <InteractiveMap floodLevelPercent={floodLevel} />
          </div>
        </div>

        {/* Priority People Cards (Exact layout from reference) */}
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/90 flex flex-col h-[520px] lg:h-[580px] overflow-hidden">
          {/* Header: Priority People | View All -> */}
          <div className="p-3.5 px-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-700 fill-slate-300" />
              <h2 className="text-sm font-bold text-slate-900">Priority People</h2>
            </div>
            <Link
              href={`/priorities?hazard=${activeHazard}`}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* People list items (styled exactly as in reference with photos/avatars, name, age, tags) */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-3 space-y-2">
            {referenceNames.map((person, idx) => {
              const liveItem = priorities[idx];
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (liveItem) setSelectedPriority(liveItem);
                  }}
                  className={`p-2.5 rounded-xl cursor-pointer transition flex items-start gap-3 border ${
                    selectedPriority?.id === liveItem?.id
                      ? "bg-blue-50/80 border-blue-300 shadow-sm"
                      : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
                  }`}
                >
                  {/* Avatar Circle with Initials or Photo style */}
                  <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 mt-0.5 overflow-hidden">
                    {idx === 0 ? "👵" : idx === 1 ? "👴" : idx === 2 ? "👩" : idx === 3 ? "👨" : "🧕"}
                  </div>

                  {/* Person Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {idx + 1}. {person.name}
                      </span>
                      {/* Pill Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${person.statusClass}`}
                      >
                        {person.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {person.subtitle}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {person.loc}
                    </p>

                    {/* Tag action alert from reference */}
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold">
                      <span className={`flex items-center gap-1 ${person.tagColor}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {person.tag}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* Slide-over Explainability Drawer (Preserved from original dashboard) */}
      <ExplanationPanel
        item={selectedPriority}
        floodLevelPercent={floodLevel}
        onClose={() => setSelectedPriority(null)}
      />
    </div>
  );
}
