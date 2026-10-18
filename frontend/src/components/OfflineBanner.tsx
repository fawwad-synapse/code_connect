"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { getPendingOfflineReports, syncOfflineReports } from "@/lib/offline-db";
import { toast } from "sonner";
import { UI_COPY } from "@/lib/ui-copy";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const checkQueue = async () => {
    const pending = await getPendingOfflineReports();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    checkQueue();

    const handleOnline = async () => {
      setIsOnline(true);
      toast.success(UI_COPY.status.connectionRestored);
      await handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning(UI_COPY.status.connectionLost);
      checkQueue();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(checkQueue, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    const { syncedCount, errors } = await syncOfflineReports();
    setIsSyncing(false);
    await checkQueue();

    if (syncedCount > 0) {
      toast.success(`${UI_COPY.status.syncComplete} (${syncedCount})`);
    } else if (errors > 0) {
      toast.error(UI_COPY.status.syncFailed);
    }
  };

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" className="bg-amber-600 text-slate-950 px-4 py-2 text-sm font-semibold flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 animate-bounce text-slate-950" />
            <span>{UI_COPY.status.connectionLost}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
            <span>{UI_COPY.status.pendingReports}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <span className="bg-amber-800 text-amber-100 px-2 py-0.5 rounded-full text-2xs">
            {pendingCount} {UI_COPY.status.queued}
          </span>
        )}
        {isOnline && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-slate-950 hover:bg-slate-900 text-amber-300 px-3 py-1 rounded flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? UI_COPY.status.syncing : UI_COPY.status.syncNow}
          </button>
        )}
      </div>
    </div>
  );
}
