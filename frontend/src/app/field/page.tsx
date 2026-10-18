"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  HeartPulse,
  User,
  ShieldAlert,
  Send,
  CloudOff,
  CloudLightning,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  LocateFixed,
  Wifi,
  WifiOff,
} from "lucide-react";
import { queueOfflineReport, getPendingOfflineReports, syncOfflineReports } from "@/lib/offline-db";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { UI_COPY } from "@/lib/ui-copy";
import { PageState } from "@/components/PageState";

export default function FieldPwaPage() {
  const [isOnline, setIsOnline] = useState(true);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [locationName, setLocationName] = useState("");
  const [occupants, setOccupants] = useState(3);
  const [elderlyCount, setElderlyCount] = useState(1);
  const [livesAlone, setLivesAlone] = useState(false);
  const [mobilityImpaired, setMobilityImpaired] = useState(false);
  const [medicalNeed, setMedicalNeed] = useState(false);
  const [waterDepth, setWaterDepth] = useState("1.5");
  const [signalBars, setSignalBars] = useState("1");
  const [notes, setNotes] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { setOfflineQueueCount, activeHazard } = useAppStore();

  const loadQueue = useCallback(async () => {
    try {
      const items = await getPendingOfflineReports();
      setPendingQueue(items);
      setOfflineQueueCount(items.length);
    } catch (e) {
      console.warn("Could not load local queue", e);
    }
  }, [setOfflineQueueCount]);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error("Cannot sync: device is currently offline.");
      return;
    }

    try {
      setSyncing(true);
      const res = await syncOfflineReports();
      if (res.syncedCount > 0) {
        toast.success(`Synced ${res.syncedCount} queued reports to central EOC database!`);
      } else {
        toast.info("All local field reports are already synced.");
      }
      await loadQueue();
    } catch (err: any) {
      toast.error("Sync failed: " + (err.message || "Unknown error"));
    } finally {
      setSyncing(false);
    }
  }, [loadQueue]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    loadQueue();

    const handleOnline = async () => {
      setIsOnline(true);
      toast.info("Internet connection restored! Auto-syncing pending field reports...");
      await handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Disconnected from network. Switched to offline IndexedDB storage.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleSync, loadQueue]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setGettingLocation(false);
        toast.success(`GPS acquired: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      (err) => {
        setGettingLocation(false);
        // Fallback default to central Karachi coordinates
        setLat(24.8607);
        setLng(67.0011);
        toast.warning("GPS location unavailable, set to Karachi center (" + err.message + ")");
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      const rawText = `[FIELD TRIAGE] Location: ${locationName || address || "Karachi Field Target"}. Occupants: ${occupants} (Elderly: ${elderlyCount}). Water depth: ${waterDepth}m. Lives alone: ${
        livesAlone ? "YES" : "NO"
      }. Mobility impaired: ${mobilityImpaired ? "YES" : "NO"}. Medical need: ${
        medicalNeed ? "YES" : "NO"
      }. Signal bars: ${signalBars}/4. Notes: ${notes}`;

      const reportPayload = {
        source: "FIELD_PWA",
        raw_text: rawText,
        hazard: activeHazard,
        lat: lat || 24.8607,
        lng: lng || 67.0011,
      };

      // Always save to IndexedDB queue first with idempotency key
      const queuedItem = await queueOfflineReport(reportPayload);

      if (navigator.onLine) {
        // Online: attempt immediate sync
        await handleSync();
      } else {
        toast.success(
          "Report saved to offline IndexedDB storage. It will sync automatically when signal returns."
        );
        await loadQueue();
      }

      // Reset form
      setLocationName("");
      setAddress("");
      setNotes("");
    } catch (err: any) {
      toast.error("Error saving field report: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-[#f4f7fb] text-slate-800 p-4 lg:p-6">
      <main className="max-w-2xl w-full mx-auto space-y-4">
        {/* Header matching modern light UI card system */}
        <header className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-sm">
              <CloudLightning className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Send a Field Report</h1>
              <p className="text-xs text-slate-400 mt-0.5">Record who needs help and where. Works offline.</p>
            </div>
          </div>

          <div>
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                <Wifi aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 shadow-sm">
                <WifiOff aria-hidden="true" className="h-3.5 w-3.5 text-amber-600" /> Offline
              </span>
            )}
          </div>
        </header>

        {!isOnline && <PageState kind="offline" title={UI_COPY.status.offlineSaved} message={UI_COPY.status.connectionLost} />}

        {/* Sync Banner if pending items */}
        {pendingQueue.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-sm">
            <div className="flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-amber-600" />
              <span>
                <strong>{pendingQueue.length}</strong> {UI_COPY.status.pendingReports}
              </span>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing || !isOnline}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? UI_COPY.status.syncing : UI_COPY.status.syncNow}
            </button>
          </div>
        )}

        {/* Field Intake Form in Clean White Card */}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200/90 p-5 sm:p-6 rounded-2xl shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Vulnerability & Distress Assessment
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200">
              Works offline
            </span>
          </div>

          {/* Location & GPS */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {UI_COPY.field.location} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Sector 5-E, Korangi Creek Road near Masjid Bilal"
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm transition"
            />

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={gettingLocation}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 transition shadow-sm"
              >
                <LocateFixed className={`w-3.5 h-3.5 text-blue-600 ${gettingLocation ? "animate-spin" : ""}`} />
                {lat && lng ? `Location: ${lat}, ${lng}` : UI_COPY.actions.captureLocation}
              </button>
              {lat && lng && (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {UI_COPY.field.locationSaved}
                </span>
              )}
            </div>
          </div>

          {/* Demographics & Household Vulnerabilities */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{UI_COPY.field.peopleCount}</label>
              <input
                type="number"
                min={1}
                value={occupants}
                onChange={(e) => setOccupants(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-blue-500 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{UI_COPY.field.olderPeople}</label>
              <input
                type="number"
                min={0}
                value={elderlyCount}
                onChange={(e) => setElderlyCount(parseInt(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>

          {/* Critical Risk Checkboxes */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">{UI_COPY.field.supportFlags}</label>
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200/90">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={livesAlone}
                  onChange={(e) => setLivesAlone(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-white border-slate-300"
                />
                <span>{UI_COPY.field.alone}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={mobilityImpaired}
                  onChange={(e) => setMobilityImpaired(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-white border-slate-300"
                />
                <span>{UI_COPY.field.mobility}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={medicalNeed}
                  onChange={(e) => setMedicalNeed(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-0 bg-white border-slate-300"
                />
                <span className="text-rose-600 font-bold">
                  {UI_COPY.field.medical}
                </span>
              </label>
            </div>
          </div>

          {/* Hazard Exposure & Signal */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{UI_COPY.field.water}</label>
              <select
                value={waterDepth}
                onChange={(e) => setWaterDepth(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-blue-500 shadow-sm"
              >
                <option value="0.3">Ankle deep (~0.3m)</option>
                <option value="0.8">Knee deep (~0.8m)</option>
                <option value="1.5">Waist deep (~1.5m)</option>
                <option value="2.5">Chest deep / 1st floor submerged (&gt;2m)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{UI_COPY.field.signal}</label>
              <select
                value={signalBars}
                onChange={(e) => setSignalBars(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-blue-500 shadow-sm"
              >
                <option value="0">0 bars (Total Blackout)</option>
                <option value="1">1 bar (Intermittent)</option>
                <option value="2">2 bars (Weak 2G)</option>
                <option value="4">3-4 bars (Good 4G)</option>
              </select>
            </div>
          </div>

          {/* Tactical Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {UI_COPY.field.notes}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={UI_COPY.field.notesPlaceholder}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm transition"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Saving report..." : UI_COPY.actions.submitReport}
          </button>
        </form>
      </main>
    </div>
  );
}
