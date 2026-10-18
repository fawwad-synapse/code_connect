"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Home,
  Users,
  Search,
  Filter,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  Truck,
  Bell,
  Settings,
  Radio,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { api, ShelterItem } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { PageState } from "@/components/PageState";
import { HAZARDS, Hazard } from "@/lib/hazards";

export default function SheltersPage() {
  const [shelters, setShelters] = useState<ShelterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "OPEN" | "NEAR_FULL" | "FULL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const activeHazard = useAppStore((state) => state.activeHazard);

  const fetchShelters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getResources(50, activeHazard);
      setShelters(res.shelters || []);
    } catch (err) {
      console.error(err);
      toast.error("Could not fetch shelters");
    } finally {
      setLoading(false);
    }
  }, [activeHazard]);

  useEffect(() => {
    fetchShelters();
  }, [fetchShelters]);

  const shelterImages = [
    "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
  ];

  const floodShelters = [
    { id: "S-01", name: "Clifton Community Center", distance: "2.5 km", current_occupancy: 120, capacity: 200, status: "Open", accessible: true },
    { id: "S-02", name: "Korangi Community Hall", distance: "4.1 km", current_occupancy: 180, capacity: 200, status: "Near Full", accessible: true },
    { id: "S-03", name: "Landhi Sports Complex", distance: "6.2 km", current_occupancy: 200, capacity: 200, status: "Full", accessible: true },
    { id: "S-04", name: "Gulshan Relief Camp", distance: "3.8 km", current_occupancy: 85, capacity: 150, status: "Open", accessible: false },
    { id: "S-05", name: "Shah Faisal College", distance: "7.1 km", current_occupancy: 110, capacity: 150, status: "Open", accessible: true },
    { id: "S-06", name: "Malir University Relief Center", distance: "9.4 km", current_occupancy: 60, capacity: 200, status: "Open", accessible: true },
    { id: "S-07", name: "Orangi Relief Hub", distance: "5.3 km", current_occupancy: 185, capacity: 200, status: "Near Full", accessible: false },
    { id: "S-08", name: "Govt Girls College Lyari", distance: "3.1 km", current_occupancy: 140, capacity: 350, status: "Open", accessible: true },
    { id: "S-09", name: "North Karachi Community Center", distance: "8.2 km", current_occupancy: 95, capacity: 200, status: "Open", accessible: true },
    { id: "S-10", name: "Federal B Area Relief Camp", distance: "6.7 km", current_occupancy: 138, capacity: 150, status: "Near Full", accessible: true },
    { id: "S-11", name: "Nazimabad Sports Arena", distance: "5.8 km", current_occupancy: 70, capacity: 250, status: "Open", accessible: true },
    { id: "S-12", name: "Defense Central Hall", distance: "4.4 km", current_occupancy: 90, capacity: 300, status: "Open", accessible: true },
  ];

  const heatwaveShelters = [
    { id: "C-01", name: "Lyari Public Cooling Center", distance: "2.1 km", current_occupancy: 80, capacity: 260, status: "Open", accessible: true },
    { id: "C-02", name: "Malir Heat Relief Center", distance: "5.4 km", current_occupancy: 375, capacity: 400, status: "Near Full", accessible: true },
    { id: "C-03", name: "Korangi Cooling Hall", distance: "4.8 km", current_occupancy: 300, capacity: 300, status: "Full", accessible: true },
    { id: "C-04", name: "Saddar Hydration Center", distance: "1.9 km", current_occupancy: 70, capacity: 220, status: "Open", accessible: true },
    { id: "C-05", name: "Clifton Indoor Cooling Hub", distance: "3.2 km", current_occupancy: 280, capacity: 300, status: "Near Full", accessible: true },
    { id: "C-06", name: "Gulshan Heat Respite Center", distance: "4.5 km", current_occupancy: 95, capacity: 200, status: "Open", accessible: false },
    { id: "C-07", name: "Shah Faisal Hydration Shelter", distance: "7.0 km", current_occupancy: 80, capacity: 200, status: "Open", accessible: true },
    { id: "C-08", name: "Nazimabad Cooling Station", distance: "5.5 km", current_occupancy: 188, capacity: 200, status: "Near Full", accessible: true },
    { id: "C-09", name: "North Nazimabad Relief Hub", distance: "8.1 km", current_occupancy: 75, capacity: 180, status: "Open", accessible: true },
    { id: "C-10", name: "Jamshed Town Hydration Unit", distance: "3.9 km", current_occupancy: 60, capacity: 150, status: "Open", accessible: true },
    { id: "C-11", name: "Sindh Govt Hospital Cooling Unit", distance: "6.3 km", current_occupancy: 110, capacity: 250, status: "Open", accessible: true },
    { id: "C-12", name: "PECHS Community Cooling Hall", distance: "4.2 km", current_occupancy: 85, capacity: 200, status: "Open", accessible: true },
  ];

  const getStatus = (s: any): "Open" | "Near Full" | "Full" => {
    if (s.status === "Full") return "Full";
    if (s.status === "Near Full") return "Near Full";
    if (s.status === "Open") return "Open";
    const cap = Math.max(1, s.capacity || 200);
    const occ = s.current_occupancy || 0;
    const rate = Math.round((occ / cap) * 100);
    if (rate >= 100) return "Full";
    if (rate >= 75) return "Near Full";
    return "Open";
  };

  const baseList = activeHazard === "heatwave" ? heatwaveShelters : floodShelters;
  const displayList = baseList.map((defItem) => {
    const apiMatch = shelters.find(
      (s) => s.id === defItem.id || s.name.toLowerCase() === defItem.name.toLowerCase()
    );
    if (apiMatch) {
      return {
        ...defItem,
        ...apiMatch,
        distance: defItem.distance,
        status: defItem.status,
        current_occupancy: apiMatch.current_occupancy || defItem.current_occupancy,
        capacity: apiMatch.capacity || defItem.capacity,
      };
    }
    return defItem;
  });

  const openCount = displayList.filter((s) => getStatus(s) === "Open").length;
  const nearFullCount = displayList.filter((s) => getStatus(s) === "Near Full").length;
  const fullCount = displayList.filter((s) => getStatus(s) === "Full").length;

  const filtered = displayList.filter((s: any) => {
    const status = getStatus(s);
    if (activeTab === "OPEN" && status !== "Open") return false;
    if (activeTab === "NEAR_FULL" && status !== "Near Full") return false;
    if (activeTab === "FULL" && status !== "Full") return false;
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 bg-[#f4f7fb] text-slate-800 p-4 lg:p-6 space-y-5">
      {/* Header bar matching reference */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shelters</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage shelter capacity and occupants</p>
        </div>

        {/* Search bar from reference */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search shelter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm transition"
          />
        </div>
      </header>

      {/* Tabs Row from Reference: All (12), Open (8), Near Full (3), Full (1) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "ALL" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          All ({displayList.length})
        </button>
        <button
          onClick={() => setActiveTab("OPEN")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "OPEN" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setActiveTab("NEAR_FULL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "NEAR_FULL" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
          }`}
        >
          Near Full ({nearFullCount})
        </button>
        <button
          onClick={() => setActiveTab("FULL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "FULL" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
          }`}
        >
          Full ({fullCount})
        </button>
      </div>

      {/* Grid of Shelter Cards (Exact match to reference image with photo headers) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item: any, idx: number) => {
          const cap = item.capacity || 200;
          const occ = item.current_occupancy || 100;
          const pct = Math.round((occ / cap) * 100);
          const itemStatus = getStatus(item);
          const isFull = itemStatus === "Full";
          const isNearFull = itemStatus === "Near Full";
          const bgImg = shelterImages[idx % shelterImages.length];

          return (
            <div
              key={item.id || idx}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition"
            >
              {/* Photo Banner with Shelter Icon */}
              <div className="h-36 w-full relative overflow-hidden bg-slate-100">
                <img
                  src={bgImg}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-700 shadow-sm">
                  <Home className="w-4 h-4 text-slate-800" />
                </div>
              </div>

              {/* Shelter Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{item.distance || "3.5 km"}</p>

                  {/* Occupancy numbers & percentage badge */}
                  <div className="flex items-center justify-between mt-4 mb-2 text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {occ} / {cap}
                    </span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                        isFull
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : isNearFull
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isFull
                          ? "bg-rose-600"
                          : isNearFull
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {item.accessible ? "Wheelchair accessible" : "Standard access"}
                  </span>
                  <button
                    onClick={() => toast.info(`Managing shelter: ${item.name}`)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Manage →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

