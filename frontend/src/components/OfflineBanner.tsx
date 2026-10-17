"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { getPendingOfflineReports, syncOfflineReports } from "@/lib/offline-db";
import { toast } from "sonner";

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
      toast.success("Network connection restored! Synchronizing queued reports...");
      await handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Network connection lost. Offline mode activated.");
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
      toast.success(`Synced ${syncedCount} offline report(s) without duplicates!`);
    } else if (errors > 0) {
      toast.error("Could not sync some offline reports; will retry automatically.");
    }
  };

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="bg-amber-600 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 animate-bounce text-slate-950" />
            <span>OFFLINE MODE ACTIVE: All submissions safely stored in local IndexedDB.</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
            <span>Online with {pendingCount} unsynced report(s) pending in queue.</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <span className="bg-amber-800 text-amber-100 px-2 py-0.5 rounded-full text-2xs">
            {pendingCount} Queued
          </span>
        )}
        {isOnline && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-slate-950 hover:bg-slate-900 text-amber-300 px-3 py-1 rounded flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        )}
      </div>
    </div>
  );
}
