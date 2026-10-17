"use client";

import React from "react";
import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Timeline } from "@/components/Timeline";

export default function PrepositioningPage() {
  return (
    <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Early Action Pre-Positioning Protocol
          </h1>
          <p className="text-xs text-slate-400">
            Proactive readiness staging derived from Open-Meteo rainfall predictions and localized flood risk
          </p>
        </div>
      </div>

      <Timeline />
    </main>
  );
}
