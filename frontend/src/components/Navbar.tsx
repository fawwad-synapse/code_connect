"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Layers,
  Truck,
  Home,
  Bell,
  Shield,
  Wifi,
  WifiOff,
  Radio,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { UI_COPY } from "@/lib/ui-copy";
import { HAZARDS, Hazard, isHazard } from "@/lib/hazards";

export function Navbar() {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const { offlineQueueCount, activeHazard, setActiveHazard } = useAppStore();
  const isDashboard = pathname === "/";

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
      // Selection works in memory when storage fails
    }
  };

  // Nav items corresponding to RescueNet reference while preserving existing route links
  const sidebarNavItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      href: "/priorities",
      label: "People at Risk",
      icon: Users,
      badge: null,
    },
    {
      href: "/resources",
      label: "Resource Allocation",
      icon: Layers,
      badge: null,
    },
    {
      href: "/prepositioning",
      label: "Rescue Teams",
      icon: Truck,
      badge: null,
    },
    {
      href: "/shelters",
      label: "Shelters",
      icon: Home,
      badge: null,
    },
    {
      href: "/reports",
      label: "Alerts & Reports",
      icon: Bell,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 h-screen sticky top-0 shadow-sm z-30 select-none">
      {/* Top Logo / Brand Section (Shield Icon + RescueNet) */}
      <div>
        <div className="p-5 pb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 shrink-0">
            <Shield className="w-6 h-6 fill-white text-blue-600" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-slate-900 block leading-tight">
              RescueNet
            </span>
            <span className="text-[11px] text-slate-400 block leading-none mt-0.5">
              People • Resources • Safer Communities
            </span>
          </div>
        </div>

        {/* Navigation Menu List */}
        <nav className="px-3 space-y-1.5" aria-label="Sidebar Menu">
          {sidebarNavItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={idx}
                href={`${item.href}?hazard=${activeHazard}`}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  isActive
                    ? "bg-blue-50 text-blue-600 shadow-sm font-bold border border-blue-100"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Sidebar Status: System Online status */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        {/* Disaster Mode Switcher */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Hazard Mode</span>
            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
              {activeHazard.toUpperCase()}
            </span>
          </div>
          <select
            value={activeHazard}
            onChange={(e) => changeHazard(e.target.value as Hazard)}
            className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg p-1.5 outline-none focus:border-blue-500"
          >
            {Object.entries(HAZARDS).map(([val, prof]) => (
              <option key={val} value={val}>
                {prof.icon} {prof.label}
              </option>
            ))}
          </select>
        </div>

        {/* Offline / Field Mode Link */}
        <Link
          href={`/field?hazard=${activeHazard}`}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200 text-xs font-bold transition"
        >
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-amber-600" />
            Field Report Mode
          </span>
          {offlineQueueCount > 0 ? (
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
              {offlineQueueCount}
            </span>
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
          )}
        </Link>

        {/* Green dot system online badge */}
        <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-700">System Online</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Last updated: 14 Oct 2026, 04:32 PM
        </div>
      </div>
    </aside>
  );
}
