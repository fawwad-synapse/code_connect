"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Anchor,
  HeartPulse,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";
import { api, ResourceItem, ShelterItem } from "@/lib/api";
import { toast } from "sonner";
import { UI_COPY } from "@/lib/ui-copy";
import { PageState } from "@/components/PageState";
import { useAppStore } from "@/lib/store";
import { useAppStore } from "@/lib/store";

interface AssignmentResult {
  id: string;
  resource_id: string;
  resource_name: string;
  target_id: string;
  target_address?: string;
  priority_score: number;
  transit_time_min: number;
  medical_matched: boolean;
  status: string;
  overridden: boolean;
  overridden_by?: string;
  override_reason?: string;
}

interface ConflictDetail {
  conflict_id: string;
  resource_id: string;
  resource_name: string;
  competing_targets: Array<{
    id: string;
    score: number;
    urgency: number;
    address: string;
    medical_need: boolean;
  }>;
  resolution_reason: string;
  score_delta: number;
}

interface UnassignedTarget {
  id: string;
  priority_score: number;
  occupants: number;
  reason: string;
}

export function ResourceBoard() {
  const latestPlan = useAppStore((state) => state.latestPlan);
  const latestPlan = useAppStore((state) => state.latestPlan);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [shelters, setShelters] = useState<ShelterItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentResult[]>([]);
  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
  const [unassignedTargets, setUnassignedTargets] = useState<UnassignedTarget[]>([]);
  const [hasOptimization, setHasOptimization] = useState(false);
  const [candidateCount, setCandidateCount] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [optimizationError, setOptimizationError] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentResult | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideCoordinator, setOverrideCoordinator] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.getResources();
      setResources(res.resources || []);
      setShelters(res.shelters || []);
    } catch (err) {
      console.error("Failed to load resources:", err);
      setLoadError(true);
      toast.error("Could not load resources from API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!latestPlan) return;
    setAssignments(latestPlan.assignments || []);
    setConflicts(latestPlan.conflicts || []);
    setUnassignedTargets(latestPlan.unassigned_targets || []);
    setCandidateCount(latestPlan.candidate_count || 0);
    setUnassignedCount(latestPlan.unassigned_count ?? latestPlan.unassigned_targets?.length ?? 0);
    setHasOptimization(true);
  }, [latestPlan]);

  useEffect(() => {
    if (!latestPlan) return;
    setAssignments(latestPlan.assignments || []);
    setConflicts(latestPlan.conflicts || []);
    setUnassignedTargets(latestPlan.unassigned_targets || []);
    setCandidateCount(latestPlan.candidate_count || 0);
    setHasOptimization(true);
  }, [latestPlan]);

  const handleRunOptimization = async (useFallback = false) => {
    try {
      setOptimizing(true);
      setOptimizationError(false);
      const result = await api.optimizeAssignments(useFallback);
      setAssignments(result.assignments || []);
      setConflicts(result.conflicts || []);
      setUnassignedTargets(result.unassigned_targets || []);
      setCandidateCount(result.candidate_count || 0);
      setUnassignedCount(result.unassigned_count ?? result.unassigned_targets?.length ?? 0);
      setHasOptimization(true);
      toast.success(
        `Optimization complete: ${result.assignments?.length || 0} teams dispatched via ${
          result.solver_used || "OR-Tools"
        }`
      );
    } catch (err: any) {
      setOptimizationError(true);
      toast.error("Resource optimization failed: " + (err.message || "Unknown error"));
    } finally {
      setOptimizing(false);
    }
  };

  const handleOpenOverride = (assignment: AssignmentResult) => {
    setSelectedAssignment(assignment);
    setOverrideCoordinator("");
    setOverrideReason("");
    setOverrideModalOpen(true);
  };

  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    if (!overrideCoordinator.trim() || !overrideReason.trim()) {
      toast.error("Coordinator name and rationale are mandatory for human override");
      return;
    }

    try {
      setSubmittingOverride(true);
      await api.overrideAssignment(selectedAssignment.id, {
        overridden_by: overrideCoordinator.trim(),
        override_reason: overrideReason.trim(),
      });
      toast.success(`Override logged in audit trail for ${selectedAssignment.resource_name}`);
      setOverrideModalOpen(false);

      // Update local state
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === selectedAssignment.id
            ? {
                ...a,
                overridden: true,
                overridden_by: overrideCoordinator.trim(),
                override_reason: overrideReason.trim(),
              }
            : a
        )
      );
    } catch (err: any) {
      toast.error("Failed to record override: " + (err.message || "Unknown error"));
    } finally {
      setSubmittingOverride(false);
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "BOAT":
        return <Anchor className="w-5 h-5 text-cyan-400" />;
      case "AMBULANCE":
      case "MEDICAL":
        return <HeartPulse className="w-5 h-5 text-rose-400" />;
      case "DRONE":
        return <Radio className="w-5 h-5 text-amber-400" />;
      default:
        return <Truck className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            Rescue teams and assignments
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review available teams and recommend matches by passenger space, travel time, and medical needs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Assets
          </button>

          <button
            onClick={() => handleRunOptimization(false)}
            disabled={optimizing}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${optimizing ? "animate-spin" : ""}`} />
            {optimizing ? "Preparing team recommendations..." : UI_COPY.actions.recommendAssignments}
          </button>
        </div>
      </div>

      {/* Main Grid: Resource Inventory & Dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Resource Inventory */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Available Emergency Units ({resources.length})
            </h3>
            <span className="text-xs text-slate-500">{UI_COPY.resources.currentTeams}</span>
          </div>

          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {loading && resources.length === 0 ? (
              <PageState kind="loading" title={UI_COPY.status.loading} />
            ) : loadError && resources.length === 0 ? (
              <PageState kind="error" title={UI_COPY.status.resourcesError} onRetry={() => void fetchData()} />
            ) : resources.length === 0 ? (
              <PageState kind="empty" title={UI_COPY.status.resourcesEmpty} />
            ) : resources.map((res) => (
              <div
                key={res.id}
                className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 p-3.5 rounded-xl transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/60">
                    {getResourceIcon(res.type)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      {res.name}
                      {res.medical_capable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
                          MED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{UI_COPY.resources.teamType}: {res.type}</span>
                      <span>|</span>
                      <span>{UI_COPY.resources.teamCapacity}: {res.capacity} people</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      res.status === "AVAILABLE"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {res.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Shelters Snapshot */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Receiving Shelters ({shelters.length})
            </h3>
            <div className="space-y-2">
              {shelters.map((s) => (
                <div key={s.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span>{s.name}</span>
                    <span className="text-slate-400">
                      {s.current_occupancy}/{s.capacity} ({Math.round(s.occupancy_rate * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s.occupancy_rate > 0.8
                          ? "bg-rose-500"
                          : s.occupancy_rate > 0.5
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(100, s.occupancy_rate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center & Right Column: Dispatches & Active Solver Assignments */}
        <div className="lg:col-span-2 space-y-6">
          {hasOptimization && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-blue-800/60 bg-blue-950/20 p-3">
                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-300">Households considered</div>
                <div className="mt-1 text-2xl font-black text-white">{candidateCount}</div>
              </div>
              <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-3">
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Assigned</div>
                <div className="mt-1 text-2xl font-black text-white">{assignments.length}</div>
              </div>
              <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 col-span-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-amber-300">Unassigned</div>
                <div className="mt-1 text-2xl font-black text-white">{unassignedCount}</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Active Dispatch Assignments ({assignments.length})
            </h3>
            <span className="text-xs text-slate-400">
              {assignments.length > 0 ? UI_COPY.resources.teamRecommendations : UI_COPY.resources.noRecommendationStatus}
            </span>
          </div>

          {optimizationError && <PageState kind="error" title={UI_COPY.status.assignmentsError} onRetry={() => void handleRunOptimization(false)} />}
          {optimizing && !hasOptimization ? (
            <PageState kind="loading" title={UI_COPY.status.loading} message={UI_COPY.status.assignmentsLoading} />
          ) : assignments.length === 0 ? (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 mx-auto flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-bold text-white">{UI_COPY.resources.noRecommendations}</h4>
                <p className="text-xs text-slate-400">
                  {UI_COPY.resources.emptyHelp}
                </p>
              </div>
              <button
                onClick={() => handleRunOptimization(false)}
                disabled={optimizing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {UI_COPY.actions.recommendAssignments}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((asgn) => (
                <div
                  key={asgn.id}
                  className={`bg-slate-900 border ${
                    asgn.overridden ? "border-amber-500/50 bg-amber-950/10" : "border-slate-800"
                  } p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-700`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white">{asgn.resource_name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-semibold text-blue-400">
                        {asgn.target_address || asgn.target_id}
                      </span>
                      {asgn.overridden && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          HUMAN OVERRIDDEN
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        Arrives in about {asgn.transit_time_min} min
                      </span>
                      <span>|</span>
                      <span title={UI_COPY.terms.helpPriorityHelp}>Help priority: <strong className="text-rose-400">{asgn.priority_score.toFixed(1)}</strong></span>
                      <span>|</span>
                      <span className={asgn.medical_matched ? "text-emerald-400 font-medium" : "text-slate-400"}>
                        {asgn.medical_matched ? "Medical Certified Match" : "Standard Evacuation"}
                      </span>
                    </div>

                    {asgn.overridden && asgn.override_reason && (
                      <div className="mt-2 text-xs bg-amber-950/30 border border-amber-900/50 text-amber-200/90 p-2 rounded-lg">
                        <strong>Logged Coordinator Rationale ({asgn.overridden_by}):</strong> {asgn.override_reason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenOverride(asgn)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-amber-900/40 text-slate-300 hover:text-amber-200 border border-slate-700 hover:border-amber-700/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {UI_COPY.resources.changeRecord}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasOptimization && unassignedTargets.length > 0 && (
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">{UI_COPY.resources.unassigned}</h3>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {unassignedTargets.map((target) => (
                  <div key={target.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-slate-200">{target.id} ({target.occupants} people, score {target.priority_score})</span>
                    <span className="text-amber-200/80">{target.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade-off Conflicts Section */}
          {conflicts.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Resource Contention & Trade-off Explanations
              </h3>
              <div className="space-y-3">
                {conflicts.map((conf) => (
                  <div
                    key={conf.conflict_id}
                    className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-rose-300">
                      <span>{UI_COPY.resources.teamsNeeded}: {conf.resource_name}</span>
                      <span className="text-slate-400 font-mono">Score Delta: +{conf.score_delta.toFixed(1)}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{conf.resolution_reason}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-900/30">
                      {conf.competing_targets.map((tgt, i) => (
                        <div key={tgt.id} className="bg-slate-900/60 p-2 rounded border border-slate-800">
                          <div className="text-[11px] font-bold text-white">
                            Candidate #{i + 1}: {tgt.address}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Help priority: {tgt.score} | Medical help: {tgt.medical_need ? "Needed" : "Not flagged"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Human Override Modal */}
      {overrideModalOpen && selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">{UI_COPY.resources.changeHeading}</h3>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-mono"
              >
                X
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-slate-850 p-3 rounded-lg space-y-1">
              <div>
                <strong>Unit:</strong> {selectedAssignment.resource_name}
              </div>
              <div>
                <strong>Current Target:</strong> {selectedAssignment.target_address || selectedAssignment.target_id}
              </div>
              <div>
                  <strong>Help priority:</strong> {selectedAssignment.priority_score.toFixed(1)}
              </div>
            </div>

            <form onSubmit={handleSubmitOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Coordinator name or ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commander Asad Khan (EOC Karachi)"
                  value={overrideCoordinator}
                  onChange={(e) => setOverrideCoordinator(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {UI_COPY.resources.changeWhy} <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={UI_COPY.resources.changeWhyPlaceholder}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/20 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {submittingOverride ? "Saving note..." : "Confirm and record override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
