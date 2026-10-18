"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Copy,
  Layers,
  MapPin,
  Clock,
  Languages,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { UI_COPY } from "@/lib/ui-copy";
import { PageHeader } from "@/components/PageHeader";
import { PageState } from "@/components/PageState";
import { useAppStore } from "@/lib/store";

interface ReportItem {
  id: string;
  source: string;
  raw_text: string;
  status: string;
  cluster_id?: string;
  is_duplicate: boolean;
  created_at: string;
  location?: { lng: number; lat: number };
  parsed_data?: {
    hazard_type?: string;
    water_depth_m?: number;
    trapped_count?: number;
    medical_need?: boolean;
    language_detected?: string;
  };
}

export default function ReportsPage() {
  const activeHazard = useAppStore((state) => state.activeHazard);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rawText, setRawText] = useState("");
  const [source, setSource] = useState("PUBLIC_FORM");
  const [lat, setLat] = useState("24.8607");
  const [lng, setLng] = useState("67.0011");

  const sampleMessages = [
    {
      label: "Roman Urdu (Medical)",
      text: "Ghar me pani 4 foot a gaya hai aur ammi chal nahi saktin, Korangi sector 4",
      lat: "24.832",
      lng: "67.125",
    },
    {
      label: "English (Trapped)",
      text: "Water level rising rapidly in Lyari near Miran Naka. 5 people trapped on ground floor, 2 elderly.",
      lat: "24.866",
      lng: "66.988",
    },
    {
      label: "Urdu Script (Flood Emergency)",
      text: UI_COPY.reports.sampleRomanUrdu,
      lat: "24.895",
      lng: "67.195",
    },
  ];

  const fetchReports = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.getReports(50, activeHazard);
      setReports(res.reports || []);
    } catch (err: any) {
      setLoadError(true);
      console.error("Failed to load reports:", err);
      toast.error("Could not fetch reports from backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  // fetchReports is intentionally local; hazard selection is the refetch trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHazard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    try {
      setSubmitting(true);
      setSubmitError(false);
      setSubmitSuccess(false);
      const idempotencyKey = "manual_" + Date.now();
      const res = await api.submitReport(
        {
          source,
          raw_text: rawText.trim(),
          lat: parseFloat(lat) || undefined,
          lng: parseFloat(lng) || undefined,
        },
        idempotencyKey,
        activeHazard
      );
      setSubmitSuccess(true);

      toast.success(
        res.is_duplicate
          ? `Report ingested & clustered into cluster #${res.cluster_id || "DEDUPE"}`
          : "Report sent for review."
      );
      setRawText("");
      fetchReports();
    } catch (err: any) {
      setSubmitError(true);
      toast.error("Submission failed: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        title={UI_COPY.pages.reportsTitle}
        description={UI_COPY.pages.reportsDescription}
        icon={<FileText className="h-6 w-6" />}
        backHref="/"
        actions={<button
          onClick={() => fetchReports()}
          disabled={loading}
          className="min-h-11 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
          aria-label={UI_COPY.actions.refresh}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Feed
        </button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Ingest Report */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Incident Intake Form
            </h2>
            <span className="text-[11px] text-slate-500">Example messages are samples, not live incidents.</span>
          </div>

          {/* Preset Prompts */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5 text-blue-400" />
              {UI_COPY.reports.presetLabel}:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {sampleMessages.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setRawText(sample.text);
                    setLat(sample.lat);
                    setLng(sample.lng);
                  }}
                  className="text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 px-2.5 py-1 rounded-md transition"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {UI_COPY.reportForm.prompt} <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={UI_COPY.reportForm.promptHelp}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.reportForm.latitude}</label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.reportForm.longitude}</label>
                <input
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{UI_COPY.reportForm.source}</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
              >
                <option value="PUBLIC_FORM">Public Web Form</option>
                <option value="TELEGRAM">Telegram Bot (@RescueRankBot)</option>
                <option value="WHATSAPP">WhatsApp Helpline</option>
                <option value="FIELD_AGENT">Field Agent Triage</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "Sending report..." : UI_COPY.actions.submitReport}
            </button>
          </form>
          {submitSuccess && <div role="status" aria-live="polite" className="mt-3 rounded-lg border border-emerald-700 bg-emerald-950 p-3 text-sm text-emerald-100">{UI_COPY.status.reportSent}</div>}
          {submitError && <PageState kind="error" title={UI_COPY.status.reportSubmitError} />}
        </div>

        {/* Right Feed: Ingested & Clustered Reports */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Processed Incident Feed ({reports.length})
            </h2>
            <span className="text-[11px] text-slate-400">{UI_COPY.reports.feedHint}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[580px] pr-1">
            {loading && reports.length === 0 ? (
              <PageState kind="loading" title={UI_COPY.status.loading} />
            ) : loadError && reports.length === 0 ? (
              <PageState kind="error" title={UI_COPY.status.reportsError} onRetry={() => void fetchReports()} />
            ) : reports.length === 0 ? (
              <PageState kind="empty" title={UI_COPY.status.reportsEmpty} />
            ) : reports.map((rep) => (
              <div
                key={rep.id}
                className={`bg-slate-950 border ${
                  rep.is_duplicate ? "border-amber-900/40 bg-amber-950/10" : "border-slate-800"
                } p-4 rounded-xl space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">{rep.id}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {rep.source}
                    </span>
                    {rep.is_duplicate && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                        <Copy className="w-3 h-3" />
                        CLUSTERED (Cluster #{rep.cluster_id?.slice(-4) || "DEDUPE"})
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {new Date(rep.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-xs text-white leading-relaxed">{rep.raw_text}</p>

                {rep.parsed_data && (
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                    {rep.parsed_data.hazard_type && (
                      <span>{UI_COPY.reportForm.emergencyType}: <strong className="text-slate-200">{rep.parsed_data.hazard_type}</strong></span>
                    )}
                    {rep.parsed_data.water_depth_m && (
                      <span>{UI_COPY.reportForm.waterLevel}: <strong className="text-blue-400">{rep.parsed_data.water_depth_m}m</strong></span>
                    )}
                    {rep.parsed_data.trapped_count && (
                      <span>{UI_COPY.reportForm.peopleTrapped}: <strong className="text-rose-400">{rep.parsed_data.trapped_count}</strong></span>
                    )}
                    {rep.parsed_data.medical_need && (
                      <span className="text-rose-400 font-bold">{UI_COPY.reportForm.medicalNeeded}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
