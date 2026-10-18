"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ListOrdered, RefreshCw } from "lucide-react";
import { api, PriorityItem } from "@/lib/api";
import { PriorityList } from "@/components/PriorityList";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { UI_COPY } from "@/lib/ui-copy";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";

export default function PrioritiesPage() {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  const { selectedPriority, setSelectedPriority } = useAppStore();

  const fetchPriorities = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.getPriorities({ page, page_size: pageSize });
      setPriorities(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      setLoadError(true);
      console.error("Failed to load priorities:", err);
      toast.error("Could not fetch priority ledger from backend");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPriorities();
  }, [fetchPriorities]);

  return (
    <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 space-y-5 flex flex-col h-[calc(100vh-64px)]">
      <PageHeader
        title={UI_COPY.pages.prioritiesTitle}
        description={`${UI_COPY.pages.prioritiesDescription} ${totalCount} households.`}
        icon={<ListOrdered className="h-6 w-6" />}
        backHref="/"
        actions={
          <button
            onClick={() => fetchPriorities()}
            disabled={loading}
            className="min-h-11 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
            aria-label={UI_COPY.actions.refresh}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {UI_COPY.actions.refresh}
          </button>
        }
      />

      {/* Main Content Area: Priority Table */}
      <div className="flex-1 min-h-0">
        {loading && priorities.length === 0 ? (
          <PageState kind="loading" title={UI_COPY.status.loading} />
        ) : loadError && priorities.length === 0 ? (
          <PageState kind="error" title={UI_COPY.status.prioritiesError} onRetry={() => void fetchPriorities()} />
        ) : priorities.length === 0 ? (
          <PageState kind="empty" title={UI_COPY.status.noResults} />
        ) : <PriorityList
          priorities={priorities}
          onSelectPriority={(item) => setSelectedPriority(item)}
          selectedId={selectedPriority?.id}
        />}
      </div>

      {/* Slide-over Explainability Drawer */}
      <ExplanationPanel item={selectedPriority} onClose={() => setSelectedPriority(null)} />
    </main>
  );
}
