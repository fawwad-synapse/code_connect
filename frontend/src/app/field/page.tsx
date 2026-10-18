"use client";

import React, { useState, useEffect } from "react";
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
import { PageHeader } from "@/components/PageHeader";
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

  const { setOfflineQueueCount } = useAppStore();

  const loadQueue = async () => {
    try {
      const items = await getPendingOfflineReports();
      setPendingQueue(items);
      setOfflineQueueCount(items.length);
    } catch (e) {
      console.warn("Could not load local queue", e);
    }
  };

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
  }, []);

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

  const handleSync = async () => {
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
    <main className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-6 space-y-5">
      <PageHeader
        title={UI_COPY.pages.fieldTitle}
        description={UI_COPY.pages.fieldDescription}
        icon={<CloudLightning className="h-6 w-6" />}
        actions={isOnline ? (
          <span className="min-h-11 inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-950 px-4 text-sm font-semibold text-emerald-200">
            <Wifi aria-hidden="true" className="h-4 w-4" /> {UI_COPY.status.online}
          </span>
        ) : (
          <span className="min-h-11 inline-flex items-center gap-2 rounded-full border border-amber-700 bg-amber-950 px-4 text-sm font-semibold text-amber-100">
            <WifiOff aria-hidden="true" className="h-4 w-4" /> {UI_COPY.status.offline}
          </span>
        )}
      />

      {!isOnline && <PageState kind="offline" title={UI_COPY.status.offlineSaved} message={UI_COPY.status.connectionLost} />}

      {/* Sync Banner if pending items */}
      {pendingQueue.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-900/50 p-4 rounded-xl flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-amber-400" />
            <span>
              <strong>{pendingQueue.length}</strong> {UI_COPY.status.pendingReports}
            </span>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing || !isOnline}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-1.5 transition shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? UI_COPY.status.syncing : UI_COPY.status.syncNow}
          </button>
        </div>
      )}

      {/* Field Intake Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Vulnerability & Distress Assessment
          </h2>
            <span className="text-[11px] text-slate-500">Works offline</span>
        </div>

        {/* Location & GPS */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            {UI_COPY.field.location} <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. Sector 5-E, Korangi Creek Road near Masjid Bilal"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={gettingLocation}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
            >
              <LocateFixed className={`w-3.5 h-3.5 text-blue-400 ${gettingLocation ? "animate-spin" : ""}`} />
              {lat && lng ? `Location: ${lat}, ${lng}` : UI_COPY.actions.captureLocation}
            </button>
            {lat && lng && (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {UI_COPY.field.locationSaved}
              </span>
            )}
          </div>
        </div>

        {/* Demographics & Household Vulnerabilities */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.field.peopleCount}</label>
            <input
              type="number"
              min={1}
              value={occupants}
              onChange={(e) => setOccupants(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.field.olderPeople}</label>
            <input
              type="number"
              min={0}
              value={elderlyCount}
              onChange={(e) => setElderlyCount(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Critical Risk Checkboxes */}
        <div className="space-y-2 pt-2">
          <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.field.supportFlags}</label>
          <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={livesAlone}
                onChange={(e) => setLivesAlone(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span>{UI_COPY.field.alone}</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={mobilityImpaired}
                onChange={(e) => setMobilityImpaired(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span>{UI_COPY.field.mobility}</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={medicalNeed}
                onChange={(e) => setMedicalNeed(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span className="text-rose-300 font-semibold">
                {UI_COPY.field.medical}
              </span>
            </label>
          </div>
        </div>

        {/* Hazard Exposure & Signal */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.field.water}</label>
            <select
              value={waterDepth}
              onChange={(e) => setWaterDepth(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
            >
              <option value="0.3">Ankle deep (~0.3m)</option>
              <option value="0.8">Knee deep (~0.8m)</option>
              <option value="1.5">Waist deep (~1.5m)</option>
              <option value="2.5">Chest deep / 1st floor submerged (&gt;2m)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.field.signal}</label>
            <select
              value={signalBars}
              onChange={(e) => setSignalBars(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
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
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {UI_COPY.field.notes}
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          placeholder={UI_COPY.field.notesPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Saving report..." : UI_COPY.actions.submitReport}
        </button>
      </form>
    </main>
  );
}
