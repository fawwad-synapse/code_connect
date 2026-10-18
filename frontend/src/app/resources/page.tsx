"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Truck,
  RotateCw,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  HeartPulse,
  Package,
  Layers,
  ArrowRight,
} from "lucide-react";
import { api, ResourceItem } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "VEHICLES" | "SUPPLIES" | "MEDICAL">("ALL");
  const activeHazard = useAppStore((state) => state.activeHazard);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getResources(50, activeHazard);
      setResources(res.resources || []);
    } catch (err) {
      console.error(err);
      toast.error("Could not load resources");
    } finally {
      setLoading(false);
    }
  }, [activeHazard]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const defaultResources = [
    { id: "RV-01", name: "4x4 Truck", type: "Vehicle", status: "Available", location: "Base - Clifton", assignedTo: "Unassigned", icon: "🚚" },
    { id: "RV-02", name: "Boat", type: "Vehicle", status: "In Use", location: "Korangi", assignedTo: "Team Alpha", icon: "🚤" },
    { id: "RV-03", name: "Ambulance", type: "Vehicle", status: "Available", location: "Landhi", assignedTo: "Unassigned", icon: "🚑" },
    { id: "MS-01", name: "First Aid Kits", type: "Medical", status: "Available", location: "Central Warehouse", assignedTo: "-", icon: "🩹" },
    { id: "MS-02", name: "Emergency Medicines", type: "Medical", status: "Low Stock", location: "Landhi Shelter", assignedTo: "-", icon: "💊" },
  ];

  const displayItems = resources.length > 0
    ? resources.map((r, i) => ({
        id: r.id || `R-0${i + 1}`,
        name: r.name,
        type: r.medical_capable ? "Medical" : "Vehicle",
        status: r.status === "AVAILABLE" ? "Available" : "In Use",
        location: "Karachi Base",
        assignedTo: r.status === "AVAILABLE" ? "Unassigned" : "Team Dispatched",
        icon: r.type === "BOAT" ? "🚤" : r.medical_capable ? "🚑" : "🚚",
      }))
    : defaultResources;

  const filtered = displayItems.filter((item) => {
    if (activeTab === "VEHICLES" && item.type !== "Vehicle") return false;
    if (activeTab === "MEDICAL" && item.type !== "Medical") return false;
    if (activeTab === "SUPPLIES" && item.type !== "Supplies" && item.type !== "Medical") return false;
    return true;
  });

  return (
    <div className="flex-1 bg-[#f4f7fb] text-slate-800 p-4 lg:p-6 space-y-5">
      {/* Page Title from Reference */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Resources</h1>
          <p className="text-xs text-slate-500 mt-0.5">Available vehicles, supplies and equipment</p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3.5 py-2 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
          Refresh
        </button>
      </header>

      {/* Tabs Row from Reference: All Resources, Vehicles (18), Supplies (1,240), Medical (320) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "ALL" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          All Resources
        </button>
        <button
          onClick={() => setActiveTab("VEHICLES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "VEHICLES" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          Vehicles (18)
        </button>
        <button
          onClick={() => setActiveTab("SUPPLIES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "SUPPLIES" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          Supplies (1,240)
        </button>
        <button
          onClick={() => setActiveTab("MEDICAL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "MEDICAL" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          Medical (320)
        </button>
      </div>

      {/* 3 Metric Cards from Reference: Rescue Vehicles | Medical Supplies | Relief Supplies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Rescue Vehicles */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 leading-none">18</h3>
            <p className="text-xs font-bold text-slate-700 mt-1">Rescue Vehicles</p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">12 Available</p>
          </div>
        </div>

        {/* Card 2: Medical Supplies */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 leading-none">320</h3>
            <p className="text-xs font-bold text-slate-700 mt-1">Medical Supplies</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">65% in stock</p>
          </div>
        </div>

        {/* Card 3: Relief Supplies */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 leading-none">1,240</h3>
            <p className="text-xs font-bold text-slate-700 mt-1">Relief Supplies</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">70% in stock</p>
          </div>
        </div>
      </div>

      {/* Resource Table from Reference */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-bold text-slate-500">
                <th className="py-3.5 px-4">Resource</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((item, idx) => {
                const isAvailable = item.status === "Available";
                const isInUse = item.status === "In Use";
                const isLowStock = item.status === "Low Stock";

                return (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <div className="font-bold text-slate-900">{item.id}</div>
                          <div className="text-[11px] text-slate-400">{item.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{item.type}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                          isAvailable
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isInUse
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{item.location}</td>
                    <td className="py-3.5 px-4 text-slate-500">{item.assignedTo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
