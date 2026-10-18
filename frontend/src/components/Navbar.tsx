"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldAlert,
  ListOrdered,
  Truck,
  Clock,
  Radio,
  Wifi,
  WifiOff,
  FileText,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { UI_COPY } from "@/lib/ui-copy";
import { HAZARDS, Hazard, isHazard } from "@/lib/hazards";

export function Navbar() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const { offlineQueueCount, activeHazard, setActiveHazard } = useAppStore();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("hazard");
      const fromStorage = window.localStorage.getItem("rescue-hazard");
      const chosen = isHazard(fromUrl) ? fromUrl : isHazard(fromStorage) ? fromStorage : "flood";
      setActiveHazard(chosen);
      const url = new URL(window.location.href);
      url.searchParams.set("hazard", chosen);
      window.history.replaceState({}, "", url);
    } catch {
      setActiveHazard("flood");
    }
  }, [setActiveHazard]);

  const changeHazard = (hazard: Hazard) => {
    setActiveHazard(hazard);
    try {
      window.localStorage.setItem("rescue-hazard", hazard);
      const url = new URL(window.location.href);
      url.searchParams.set("hazard", hazard);
      window.history.replaceState({}, "", url);
    } catch {
      // Selection still works in memory when browser storage is unavailable.
    }
  };

  const navLinks = [
    { href: "/", label: UI_COPY.navigation.home, icon: ShieldAlert },
    { href: "/priorities", label: UI_COPY.navigation.priorities, icon: ListOrdered },
    { href: "/resources", label: UI_COPY.navigation.resources, icon: Truck },
    { href: "/prepositioning", label: UI_COPY.navigation.preparation, icon: Clock },
    { href: "/reports", label: UI_COPY.navigation.reports, icon: FileText },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-3 md:px-6 py-3 flex items-center justify-between gap-2">
      {/* Brand */}
      <Link href={`/?hazard=${activeHazard}`} className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition">
          RR
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-white">
              RescueRank
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold uppercase tracking-wider">
              Karachi {HAZARDS[activeHazard].label} EOC
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/40 font-semibold">
              Synthetic demo data
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Explainable Disaster Prioritization & Coordination</p>
        </div>
      </Link>

      {/* Nav items */}
      <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={`${item.href}?hazard=${activeHazard}`}
              aria-current={isActive ? "page" : undefined}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <details className="relative md:hidden">
        <summary aria-label={UI_COPY.navigation.menu} className="ui-button-secondary list-none cursor-pointer">☰</summary>
        <nav aria-label="Main navigation" className="absolute right-0 top-full z-50 mt-2 flex min-w-56 flex-col rounded-xl border border-slate-600 bg-slate-900 p-2 shadow-xl">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return <Link key={item.href} href={`${item.href}?hazard=${activeHazard}`} aria-current={isActive ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-blue-600 text-white" : "text-slate-200 hover:bg-slate-800"}`}><Icon aria-hidden="true" className="h-4 w-4" />{item.label}</Link>;
          })}
        </nav>
      </details>

      {/* Right Action: Field Worker PWA & Connectivity */}
      <div className="flex items-center gap-3">
        <select
          aria-label="Disaster type"
          value={activeHazard}
          onChange={(event) => changeHazard(event.target.value as Hazard)}
          className={`lg:hidden min-h-11 max-w-28 rounded-lg border bg-slate-950 px-2 text-sm text-white ${activeHazard === "heatwave" ? "border-orange-500" : "border-cyan-600"}`}
        >
          {Object.entries(HAZARDS).map(([value, profile]) => <option key={value} value={value}>{profile.icon} {profile.label}</option>)}
        </select>
        <label className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-300">
          Disaster type
          <select
            aria-label="Disaster type"
            value={activeHazard}
            onChange={(event) => changeHazard(event.target.value as Hazard)}
            className={`min-h-11 rounded-lg border bg-slate-950 px-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 ${activeHazard === "heatwave" ? "border-orange-500 focus-visible:ring-orange-400" : "border-cyan-600 focus-visible:ring-cyan-400"}`}
          >
            {Object.entries(HAZARDS).map(([value, profile]) => <option key={value} value={value}>{profile.icon} {profile.label}</option>)}
          </select>
        </label>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-semibold">Offline Mode</span>
            </>
          )}
        </div>

        <Link
          href={`/field?hazard=${activeHazard}`}
          className="relative min-h-11 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/25 transition"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          {UI_COPY.navigation.field}
          {offlineQueueCount > 0 && (
            <span className="ml-1 bg-white text-amber-700 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {offlineQueueCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
