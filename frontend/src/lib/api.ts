const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ZoneItem {
  id: string;
  name: string;
  geometry: any;
  elevation_m: number;
  deprivation_index: number;
  report_count: number;
  is_silent_zone: boolean;
  hazard_forecast: {
    hazard_type: string;
    depth_m_forecast: number;
    eta_hours: number;
    is_fallback: boolean;
  };
}

export interface WaterwayItem {
  id: string;
  name: string;
  kind: "river" | "creek" | "coast" | "nullah";
  source: string;
  geometry: GeoJSON.Geometry;
}

export interface FactorBreakdown {
  name: string;
  label: string;
  raw_value: number;
  weight: number;
  contribution_score: number;
  percentage: number;
}

export interface PriorityItem {
  id: string;
  zone_id: string;
  zone_name: string;
  location: { lng: number; lat: number };
  age: number;
  lives_alone: boolean;
  mobility_impaired: boolean;
  chronic_medical_need: boolean;
  housing_type: string;
  floor_level: number;
  has_smartphone: boolean;
  signal_quality: number;
  alert_acknowledged: boolean;
  priority_score: number;
  vulnerability_index: number;
  warning_gap: number;
  hazard_exposure: number;
  urgency: number;
  water_proximity_m?: number | null;
  water_proximity_risk?: number;
  occupants?: number;
  confidence: number;
  confidence_level: "HIGH" | "MEDIUM" | "LOW";
  is_silent_zone: boolean;
  missing_fields: string[];
  factor_breakdown: FactorBreakdown[];
  summary_reason: string;
  depth_m_forecast: number;
  eta_hours: number;
}

export interface ResourceItem {
  id: string;
  name: string;
  type: string;
  capacity: number;
  location: { lng: number; lat: number };
  status: string;
  medical_capable: boolean;
}

export interface ShelterItem {
  id: string;
  name: string;
  location: { lng: number; lat: number };
  capacity: number;
  current_occupancy: number;
  occupancy_rate: number;
  accessible: boolean;
}

export interface BlockedRoadItem {
  id: string;
  name: string;
  status: string;
  depth_m: number;
  coords: number[][];
}

export interface AssignmentMapItem {
  id: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  resource_location: { lng: number; lat: number };
  target_id: string;
  target_location: { lng: number; lat: number };
  transit_time_min: number;
  reason: string;
  confidence: number;
}

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    return res.json();
  },

  async getZones(): Promise<{ zones: ZoneItem[]; count: number }> {
    const res = await fetch(`${API_BASE}/api/v1/zones`);
    return res.json();
  },

  async getWaterways(): Promise<{ waterways: WaterwayItem[]; count: number }> {
    const res = await fetch(`${API_BASE}/api/v1/waterways`);
    return res.json();
  },

  async getPriorities(params?: {
    zone_id?: string;
    medical_only?: boolean;
    alone_only?: boolean;
    low_confidence_only?: boolean;
    min_score?: number;
    page?: number;
    page_size?: number;
    flood_level_percent?: number;
  }): Promise<{ total: number; page: number; page_size: number; items: PriorityItem[] }> {
    const q = new URLSearchParams();
    if (params?.zone_id) q.set("zone_id", params.zone_id);
    if (params?.medical_only) q.set("medical_only", "true");
    if (params?.alone_only) q.set("alone_only", "true");
    if (params?.low_confidence_only) q.set("low_confidence_only", "true");
    if (params?.min_score) q.set("min_score", params.min_score.toString());
    if (params?.page) q.set("page", params.page.toString());
    if (params?.page_size) q.set("page_size", params.page_size.toString());
    if (params?.flood_level_percent !== undefined) q.set("flood_level_percent", params.flood_level_percent.toString());

    const res = await fetch(`${API_BASE}/api/v1/priorities?${q.toString()}`);
    return res.json();
  },

  async getExplanation(householdId: string) {
    const res = await fetch(`${API_BASE}/api/v1/priorities/${householdId}/explanation`);
    return res.json();
  },

  async getResources(): Promise<{ resources: ResourceItem[]; shelters: ShelterItem[]; blocked_roads: BlockedRoadItem[] }> {
    const res = await fetch(`${API_BASE}/api/v1/resources`);
    return res.json();
  },

  async optimizeAssignments(useFallback = false) {
    const res = await fetch(`${API_BASE}/api/v1/assignments/optimize?use_fallback_solver=${useFallback}`, {
      method: "POST",
    });
    return res.json();
  },

  async getAssignments(): Promise<{ assignments: AssignmentMapItem[]; assigned_count: number }> {
    const res = await fetch(`${API_BASE}/api/v1/assignments`);
    return res.json();
  },

  async overrideAssignment(assignmentId: string, payload: { overridden_by: string; override_reason: string; new_resource_id?: string }) {
    const res = await fetch(`${API_BASE}/api/v1/assignments/${assignmentId}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getReports(limit = 50) {
    const res = await fetch(`${API_BASE}/api/v1/reports?limit=${limit}`);
    return res.json();
  },

  async submitReport(payload: { source: string; raw_text: string; lng?: number; lat?: number; photo_url?: string }, idempotencyKey?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    const res = await fetch(`${API_BASE}/api/v1/reports`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Report sync failed with HTTP ${res.status}`);
    }
    return res.json();
  },

  async getTimeline() {
    const res = await fetch(`${API_BASE}/api/v1/prepositioning/timeline`);
    return res.json();
  },

  async runScenario(scenario: string) {
    const res = await fetch(`${API_BASE}/api/v1/simulate/${scenario}`, {
      method: "POST",
    });
    return res.json();
  },
};
