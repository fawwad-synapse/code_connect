"use client";

import React, { useState } from "react";
import {
  MapPin,
  Clock,
  Phone,
  Shield,
  RotateCw,
  Send,
  Truck,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface RescueTeam {
  id: string;
  name: string;
  phone: string;
  members: number;
  status: "Deployed" | "Available" | "On Break";
  statusClass: string;
  location: string;
  eta: string;
  currentTask: string;
  avatars: string[];
  hasProgress: boolean;
  progressPct: number;
  assignedVehicles?: string[];
}

const INITIAL_TEAMS: RescueTeam[] = [
  {
    id: "T-01",
    name: "Team Alpha",
    phone: "+92 300 1234567",
    members: 6,
    status: "Deployed",
    statusClass: "bg-rose-50 text-rose-600 border-rose-200",
    location: "Korangi - Flood Area",
    eta: "ETA to next location 20 min",
    currentTask: "Evacuating 15 residents",
    avatars: ["👨‍🚒", "👩‍⚕️", "👨‍✈️"],
    hasProgress: true,
    progressPct: 65,
    assignedVehicles: ["4x4 Rescue Truck", "Inflatable Rescue Boat"],
  },
  {
    id: "T-02",
    name: "Team Bravo",
    phone: "+92 321 9876543",
    members: 5,
    status: "Available",
    statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    location: "Base - Clifton",
    eta: "",
    currentTask: "Ready for new assignment",
    avatars: ["👨‍🚒", "👨‍⚕️", "👩‍✈️"],
    hasProgress: false,
    progressPct: 0,
  },
  {
    id: "T-03",
    name: "Team Charlie",
    phone: "+92 333 4567891",
    members: 4,
    status: "Deployed",
    statusClass: "bg-rose-50 text-rose-600 border-rose-200",
    location: "Landhi Sector 4",
    eta: "ETA 35 min",
    currentTask: "Medical assistance",
    avatars: ["👩‍⚕️", "👨‍🚒"],
    hasProgress: false,
    progressPct: 0,
    assignedVehicles: ["Medical Ambulance"],
  },
  {
    id: "T-04",
    name: "Team Delta",
    phone: "+92 345 6789012",
    members: 5,
    status: "On Break",
    statusClass: "bg-slate-100 text-slate-600 border-slate-200",
    location: "Base - Clifton",
    eta: "",
    currentTask: "Back in 1 hour",
    avatars: ["👨‍✈️", "👩‍🚒"],
    hasProgress: false,
    progressPct: 0,
  },
  {
    id: "T-05",
    name: "Team Echo",
    phone: "+92 311 2345678",
    members: 6,
    status: "Deployed",
    statusClass: "bg-rose-50 text-rose-600 border-rose-200",
    location: "Malir Relief Center",
    eta: "ETA 15 min",
    currentTask: "Supply distribution",
    avatars: ["👨‍🚒", "👩‍⚕️"],
    hasProgress: true,
    progressPct: 40,
    assignedVehicles: ["Relief Logistics Van", "4x4 Rescue Truck"],
  },
  {
    id: "T-06",
    name: "Team Foxtrot",
    phone: "+92 322 3456789",
    members: 4,
    status: "Available",
    statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    location: "Gulshan Base",
    eta: "",
    currentTask: "Standby for water rescue",
    avatars: ["👨‍✈️", "👨‍🚒"],
    hasProgress: false,
    progressPct: 0,
  },
  {
    id: "T-07",
    name: "Team Golf",
    phone: "+92 334 5678901",
    members: 5,
    status: "Deployed",
    statusClass: "bg-rose-50 text-rose-600 border-rose-200",
    location: "Orangi Sector 11",
    eta: "ETA 10 min",
    currentTask: "Elderly evacuation",
    avatars: ["👩‍⚕️", "👨‍🚒", "👨‍⚕️"],
    hasProgress: true,
    progressPct: 80,
    assignedVehicles: ["Medical Ambulance", "4x4 Rescue Truck"],
  },
  {
    id: "T-08",
    name: "Team Hotel",
    phone: "+92 346 6789012",
    members: 4,
    status: "Available",
    statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    location: "Saddar EOC Station",
    eta: "",
    currentTask: "Ready for deployment",
    avatars: ["👨‍🚒", "👩‍⚕️"],
    hasProgress: false,
    progressPct: 0,
  },
];

const KARACHI_LOCATIONS = [
  "Korangi - Flood Area (Sector 5)",
  "Malir River Catchment & Valley",
  "Landhi Sector 4 (Inundated Area)",
  "Orangi Relief Hub (Sector 11)",
  "Lyari River Basin (Sector 7)",
  "Clifton Emergency Relief Camp",
  "North Karachi Submerged Wards",
  "Surjani Town High-Risk Sector",
  "Saddar EOC Central Command",
];

const VEHICLE_OPTIONS = [
  {
    id: "ambulance",
    label: "Medical Ambulance",
    icon: "🚑",
    desc: "Trauma-equipped with oxygen, stretcher, vitals monitor and paramedical crew",
    tag: "Life Support",
    tagClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    id: "truck",
    label: "4x4 Rescue Truck",
    icon: "🚚",
    desc: "Heavy-duty all-terrain high-clearance truck for deep water evacuation",
    tag: "Mass Evacuation",
    tagClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "boat",
    label: "Inflatable Rescue Boat",
    icon: "🚤",
    desc: "Motorized shallow-draft boat for narrow flooded alleys & submerged streets",
    tag: "Water Rescue",
    tagClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  {
    id: "van",
    label: "Relief Logistics Van",
    icon: "📦",
    desc: "Equipped with clean drinking water jerrycans, food rations & emergency blankets",
    tag: "Relief Supplies",
    tagClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export default function RescueTeamsPage() {
  const [teams, setTeams] = useState<RescueTeam[]>(INITIAL_TEAMS);
  const [activeTab, setActiveTab] = useState<"ALL" | "AVAILABLE" | "DEPLOYED" | "BREAK">("ALL");
  const [contactTeam, setContactTeam] = useState<RescueTeam | null>(null);
  const [assigningTeam, setAssigningTeam] = useState<RescueTeam | null>(null);

  // Assignment Modal State
  const [assignLocation, setAssignLocation] = useState<string>(KARACHI_LOCATIONS[0]);
  const [customLocation, setCustomLocation] = useState<string>("");
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([
    "Medical Ambulance",
    "4x4 Rescue Truck",
  ]);
  const [urgency, setUrgency] = useState<"CRITICAL" | "HIGH" | "STANDARD">("CRITICAL");

  const filtered = teams.filter((t) => {
    if (activeTab === "AVAILABLE" && t.status !== "Available") return false;
    if (activeTab === "DEPLOYED" && t.status !== "Deployed") return false;
    if (activeTab === "BREAK" && t.status !== "On Break") return false;
    return true;
  });

  const availableCount = teams.filter((t) => t.status === "Available").length;
  const deployedCount = teams.filter((t) => t.status === "Deployed").length;
  const breakCount = teams.filter((t) => t.status === "On Break").length;

  const handleOpenAssign = (team: RescueTeam) => {
    setAssigningTeam(team);
    setAssignLocation(team.location || KARACHI_LOCATIONS[0]);
    setCustomLocation("");
    setSelectedVehicles(["Medical Ambulance", "4x4 Rescue Truck"]);
    setUrgency("CRITICAL");
  };

  const toggleVehicle = (vehicleLabel: string) => {
    setSelectedVehicles((prev) =>
      prev.includes(vehicleLabel)
        ? prev.filter((v) => v !== vehicleLabel)
        : [...prev, vehicleLabel]
    );
  };

  const handleConfirmAssignment = () => {
    if (!assigningTeam) return;

    if (selectedVehicles.length === 0) {
      toast.error("Please select at least one vehicle to deploy (e.g. Medical Ambulance or Rescue Truck)");
      return;
    }

    const finalLocation = customLocation.trim() || assignLocation;

    setTeams((prev) =>
      prev.map((t) =>
        t.id === assigningTeam.id
          ? {
              ...t,
              status: "Deployed",
              statusClass: "bg-rose-50 text-rose-600 border-rose-200",
              location: finalLocation,
              currentTask: `Assigned: ${selectedVehicles.join(" + ")}`,
              eta: "ETA 15 min",
              hasProgress: true,
              progressPct: 15,
              assignedVehicles: selectedVehicles,
            }
          : t
      )
    );

    toast.success(
      `Dispatched ${assigningTeam.name} to ${finalLocation} with ${selectedVehicles.join(", ")}`
    );
    setAssigningTeam(null);
  };

  return (
    <div className="flex-1 bg-[#f4f7fb] text-slate-800 p-4 lg:p-6 space-y-5">
      {/* Header bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rescue Teams</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track team locations, assignments, vehicles and dispatch status</p>
        </div>

        <button
          onClick={() => toast.success("Team statuses and telemetry synchronized")}
          className="px-3.5 py-2 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
        >
          <RotateCw className="w-3.5 h-3.5 text-blue-600" />
          Refresh Teams
        </button>
      </header>

      {/* Tabs Row: All Teams, Available, Deployed, On Break */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "ALL" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          All Teams ({teams.length})
        </button>
        <button
          onClick={() => setActiveTab("AVAILABLE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "AVAILABLE" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          Available ({availableCount})
        </button>
        <button
          onClick={() => setActiveTab("DEPLOYED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "DEPLOYED" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          Deployed ({deployedCount})
        </button>
        <button
          onClick={() => setActiveTab("BREAK")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === "BREAK" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          On Break ({breakCount})
        </button>
      </div>

      {/* Grid of Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((team) => (
          <div
            key={team.id}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4 hover:shadow-md transition flex flex-col justify-between"
          >
            <div className="space-y-4">
              {/* Header: Icon, Name, Members count, Status pill */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                    {team.name.includes("Alpha") ? "🌊" : team.name.includes("Bravo") ? "🛡️" : team.name.includes("Charlie") ? "🚑" : "🚚"}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{team.name}</h3>
                    <p className="text-xs text-slate-400">{team.members} crew members</p>
                  </div>
                </div>

                <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${team.statusClass}`}>
                  {team.status}
                </span>
              </div>

              {/* Location & ETA */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{team.location}</span>
                </div>
                {team.eta && (
                  <div className="flex items-center gap-2 text-amber-600 font-semibold pl-6">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{team.eta}</span>
                  </div>
                )}
              </div>

              {/* Current Task */}
              <div className="pt-1">
                <span className="text-[11px] text-slate-400 block mb-1">Current Task</span>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>{team.currentTask}</span>
                </div>

                {team.hasProgress && (
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${team.progressPct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Assigned Vehicles Tags */}
              {team.assignedVehicles && team.assignedVehicles.length > 0 && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                    Deployed Vehicles
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {team.assignedVehicles.map((v, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1"
                      >
                        <span>{v.includes("Ambulance") ? "🚑" : v.includes("Boat") ? "🚤" : v.includes("Van") ? "📦" : "🚚"}</span>
                        <span>{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer: Avatars + Contact & Assign buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center -space-x-1.5">
                {team.avatars.map((av, idx) => (
                  <div
                    key={idx}
                    className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs shadow-sm"
                  >
                    {av}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setContactTeam(team)}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  Contact
                </button>
                <button
                  onClick={() => handleOpenAssign(team)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Assign
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Contact Team Modal Popup */}
      {contactTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setContactTeam(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Phone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Rescue Team Contact</h3>
              </div>
              <button
                onClick={() => setContactTeam(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Team Name, Team Number, Team Location */}
            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Team Name</span>
                <span className="text-base font-extrabold text-slate-900 block mt-0.5">{contactTeam.name}</span>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Team Number</span>
                <div className="flex items-center gap-2 mt-1">
                  <a
                    href={`tel:${contactTeam.phone}`}
                    className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 w-fit"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{contactTeam.phone}</span>
                  </a>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Team Location</span>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold mt-1 text-xs">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{contactTeam.location}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setContactTeam(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Assign Team Modal Popup (Location + Multi-select Vehicles) */}
      {assigningTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setAssigningTeam(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Assign Rescue Team: {assigningTeam.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Specify target coordinates and select deployment vehicles
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssigningTeam(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Step 1: Target Location */}
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>1. Target Deployment Location</span>
                </label>
                <select
                  value={assignLocation}
                  onChange={(e) => setAssignLocation(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                >
                  {KARACHI_LOCATIONS.map((loc, idx) => (
                    <option key={idx} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>

                <div className="mt-2">
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Or type custom address / street / landmark..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Step 2: Vehicle Multi-Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>2. Select Vehicles to Deploy (Multi-Selection)</span>
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {selectedVehicles.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  Choose Medical Ambulances, Trucks, Boats, or Vans to accompany the rescue crew:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {VEHICLE_OPTIONS.map((veh) => {
                    const isSelected = selectedVehicles.includes(veh.label);
                    return (
                      <div
                        key={veh.id}
                        onClick={() => toggleVehicle(veh.label)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{veh.icon}</span>
                            <div>
                              <span className="font-bold text-slate-900 block text-xs">
                                {veh.label}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${veh.tagClass}`}>
                                {veh.tag}
                              </span>
                            </div>
                          </div>

                          {/* Checkbox Icon */}
                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "border border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                          {veh.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Priority / Urgency */}
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  <span>3. Dispatch Priority Level</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CRITICAL", "HIGH", "STANDARD"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setUrgency(lvl)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                        urgency === lvl
                          ? lvl === "CRITICAL"
                            ? "bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-500/20"
                            : lvl === "HIGH"
                            ? "bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-500/20"
                            : "bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-500/20"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lvl === "CRITICAL" ? "🔴 Urgent / Critical" : lvl === "HIGH" ? "🟠 High Priority" : "🟢 Standard"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssigningTeam(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
