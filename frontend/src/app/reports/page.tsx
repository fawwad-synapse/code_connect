"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Bell,
  AlertTriangle,
  RotateCw,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "CRITICAL" | "VERIFIED" | "UNVERIFIED">("ALL");
  const [subTab, setSubTab] = useState<"FEED" | "DAILY" | "INCIDENT">("FEED");
  const activeHazard = useAppStore((state) => state.activeHazard);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getReports(50, activeHazard);
      setReports(res.reports || []);
    } catch (err) {
      console.error(err);
      toast.error("Could not fetch reports");
    } finally {
      setLoading(false);
    }
  }, [activeHazard]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Default mock reports matching Reference 3 (Alerts & Reports)
  const defaultFeed = [
    {
      time: "10:15 AM",
      title: "Severe flooding reported",
      location: "Korangi, Karachi",
      status: "Critical",
      statusClass: "bg-rose-50 text-rose-600 border-rose-200",
      action: "Verify",
      iconColor: "text-rose-600 bg-rose-50",
    },
    {
      time: "09:58 AM",
      title: "Elderly resident needs evacuation",
      location: "Landhi",
      status: "High",
      statusClass: "bg-rose-50 text-rose-600 border-rose-200",
      action: "Verify",
      iconColor: "text-rose-600 bg-rose-50",
    },
    {
      time: "09:40 AM",
      title: "Road blocked",
      location: "Shah Faisal Colony",
      status: "Medium",
      statusClass: "bg-amber-50 text-amber-700 border-amber-200",
      action: "View",
      iconColor: "text-amber-600 bg-amber-50",
    },
    {
      time: "09:20 AM",
      title: "Medical assistance required",
      location: "Gulshan-e-Iqbal",
      status: "High",
      statusClass: "bg-rose-50 text-rose-600 border-rose-200",
      action: "Verify",
      iconColor: "text-blue-600 bg-blue-50",
    },
    {
      time: "08:55 AM",
      title: "Multiple families stranded",
      location: "Malir",
      status: "Medium",
      statusClass: "bg-amber-50 text-amber-700 border-amber-200",
      action: "View",
      iconColor: "text-amber-600 bg-amber-50",
    },
    {
      time: "08:30 AM",
      title: "Power outage reported",
      location: "Orangi",
      status: "Low",
      statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      action: "View",
      iconColor: "text-emerald-600 bg-emerald-50",
    },
    {
      time: "08:15 AM",
      title: "Water level rising",
      location: "Lyari",
      status: "High",
      statusClass: "bg-rose-50 text-rose-600 border-rose-200",
      action: "Verify",
      iconColor: "text-rose-600 bg-rose-50",
    },
  ];

  const filteredFeed = defaultFeed.filter((item) => {
    if (activeTab === "CRITICAL" && item.status !== "Critical" && item.status !== "High") return false;
    if (activeTab === "VERIFIED" && item.action !== "View") return false;
    if (activeTab === "UNVERIFIED" && item.action !== "Verify") return false;
    return true;
  });

  return (
    <div className="flex-1 bg-[#f4f7fb] text-slate-800 p-4 lg:p-6 space-y-5">
      {/* Header bar matching reference */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Alerts & Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Incoming reports from multiple sources</p>
        </div>

        {/* View Switcher: Feed view vs Analytics view */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab("FEED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
              subTab === "FEED" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            Live Feed
          </button>
          <button
            onClick={() => setSubTab("DAILY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
              subTab === "DAILY" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            Report Analytics
          </button>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-2 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 rounded-xl transition shadow-sm"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </header>

      {subTab === "FEED" ? (
        <>
          {/* Tabs from Reference 3: All (48), Critical (12), Verified (24), Unverified (12) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                activeTab === "ALL" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              All (48)
            </button>
            <button
              onClick={() => setActiveTab("CRITICAL")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                activeTab === "CRITICAL" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              Critical (12)
            </button>
            <button
              onClick={() => setActiveTab("VERIFIED")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                activeTab === "VERIFIED" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              Verified (24)
            </button>
            <button
              onClick={() => setActiveTab("UNVERIFIED")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                activeTab === "UNVERIFIED" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              Unverified (12)
            </button>
          </div>

          {/* Table / List Container from Reference 3 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 divide-y divide-slate-100 overflow-hidden">
            {filteredFeed.map((item, idx) => (
              <div
                key={idx}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition"
              >
                {/* Left: Time + Icon + Title + Location */}
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xs font-bold text-slate-400 w-16 shrink-0">
                    {item.time}
                  </span>

                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${item.iconColor}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{item.title}</h4>
                    <p className="text-xs text-slate-400 truncate">{item.location}</p>
                  </div>
                </div>

                {/* Right: Status badge + Action Button (Verify / View) */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${item.statusClass}`}>
                    {item.status}
                  </span>

                  {item.action === "Verify" ? (
                    <button
                      onClick={() => toast.success(`Verified report: ${item.title}`)}
                      className="px-4 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      Verify
                    </button>
                  ) : (
                    <button
                      onClick={() => toast.info(`Viewing report: ${item.title}`)}
                      className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Analytics View Matching Reference 5 (Reports Analytics & Bar Chart) */
        <div className="space-y-5">
          {/* Sub Header row: Daily Report / Incident Report / Resource Utilization */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm">
                Daily Report
              </button>
              <button className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200">
                Incident Report
              </button>
              <button className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200">
                Resource Utilization
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Nov 14, 2024</span>
              </div>
              <button
                onClick={() => toast.success("Report generated and ready for export")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                Generate Report
              </button>
            </div>
          </div>

          {/* 3 Metric Cards from Reference 5 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">12</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">Incidents Handled</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">186</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">People Rescued</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">8</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">Shelters Active</p>
              </div>
            </div>
          </div>

          {/* Incidents by Area Bar Chart (CSS-based) matching Reference 5 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Incidents by Area</h3>

            <div className="h-48 flex items-end justify-between gap-4 pt-6 px-4 border-b border-slate-200">
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">32</span>
                <div className="w-full max-w-12 bg-blue-600 rounded-t-lg h-36" />
                <span className="text-xs font-semibold text-slate-600 mt-1">Korangi</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">22</span>
                <div className="w-full max-w-12 bg-blue-600 rounded-t-lg h-24" />
                <span className="text-xs font-semibold text-slate-600 mt-1">Lyari</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">19</span>
                <div className="w-full max-w-12 bg-blue-600 rounded-t-lg h-20" />
                <span className="text-xs font-semibold text-slate-600 mt-1">Shah Faisal</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">12</span>
                <div className="w-full max-w-12 bg-blue-600 rounded-t-lg h-14" />
                <span className="text-xs font-semibold text-slate-600 mt-1">Malir</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">9</span>
                <div className="w-full max-w-12 bg-blue-600 rounded-t-lg h-10" />
                <span className="text-xs font-semibold text-slate-600 mt-1">Gulshan</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">5</span>
                <div className="w-full max-w-12 bg-blue-600 rounded-t-lg h-6" />
                <span className="text-xs font-semibold text-slate-600 mt-1">Orangi</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
