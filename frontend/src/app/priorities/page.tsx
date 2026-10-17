"use client";

import React, { useEffect, useState } from "react";
import { ListOrdered, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { api, PriorityItem } from "@/lib/api";
import { PriorityList } from "@/components/PriorityList";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

export default function PrioritiesPage() {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  const { selectedPriority, setSelectedPriority } = useAppStore();

  const fetchPriorities = async () => {
    try {
      setLoading(true);
      const res = await api.getPriorities({ page, page_size: pageSize });
      setPriorities(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error("Failed to load priorities:", err);
      toast.error("Could not fetch priority ledger from backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPriorities();
  }, [page]);

  return (
    <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 space-y-5 flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-blue-500" />
              Triage Priority Ledger
            </h1>
            <p className="text-xs text-slate-400">
              Total {totalCount} households ranked by weighted vulnerability, warning gap, and hazard exposure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPriorities()}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Triage Ledger
          </button>
        </div>
      </div>

      {/* Main Content Area: Priority Table */}
      <div className="flex-1 min-h-0">
        <PriorityList
          priorities={priorities}
          onSelectPriority={(item) => setSelectedPriority(item)}
          selectedId={selectedPriority?.id}
        />
      </div>

      {/* Slide-over Explainability Drawer */}
      <ExplanationPanel item={selectedPriority} onClose={() => setSelectedPriority(null)} />
    </main>
  );
}
