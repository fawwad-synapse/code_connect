"use client";

import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, ZoneItem, PriorityItem, ResourceItem, ShelterItem, BlockedRoadItem, WaterwayItem, AssignmentMapItem } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { UI_COPY } from "@/lib/ui-copy";
import { RiskBadge } from "@/components/RiskBadge";
import { PageState } from "@/components/PageState";
import { CircleHelp } from "lucide-react";

// Fix Leaflet marker icons in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  zones?: ZoneItem[];
  priorities?: PriorityItem[];
  resources?: ResourceItem[];
  shelters?: ShelterItem[];
  blockedRoads?: BlockedRoadItem[];
  onSelectPriority?: (item: PriorityItem) => void;
  floodLevelPercent?: number;
}

export function MapClient({
  zones: propZones,
  priorities: propPriorities,
  resources: propResources,
  shelters: propShelters,
  blockedRoads: propBlockedRoads,
  onSelectPriority,
  floodLevelPercent,
}: Props) {
  const { mapLayers, setSelectedPriority } = useAppStore();
  const [internalZones, setInternalZones] = useState<ZoneItem[]>([]);
  const [internalPriorities, setInternalPriorities] = useState<PriorityItem[]>([]);
  const [priorityTotal, setPriorityTotal] = useState(0);
  const [internalResources, setInternalResources] = useState<ResourceItem[]>([]);
  const [internalShelters, setInternalShelters] = useState<ShelterItem[]>([]);
  const [internalBlockedRoads, setInternalBlockedRoads] = useState<BlockedRoadItem[]>([]);
  const [waterways, setWaterways] = useState<WaterwayItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentMapItem[]>([]);
  const [mapLoadError, setMapLoadError] = useState(false);

  useEffect(() => {
    if (!propZones || propZones.length === 0) {
      api.getZones().then((res) => setInternalZones(res.zones || [])).catch(() => setMapLoadError(true));
    }
    if (!propPriorities || propPriorities.length === 0) {
      api.getPriorities({ page_size: 150, flood_level_percent: floodLevelPercent }).then((res) => {
        setInternalPriorities(res.items || []);
        setPriorityTotal(res.total || 0);
      }).catch(() => setMapLoadError(true));
    }
    if (!propResources || propResources.length === 0) {
      api.getResources().then((res) => {
        setInternalResources(res.resources || []);
        setInternalShelters(res.shelters || []);
        setInternalBlockedRoads(res.blocked_roads || []);
      }).catch(() => setMapLoadError(true));
    }
    api.getWaterways().then((res) => setWaterways(res.waterways || [])).catch(() => setMapLoadError(true));
    api.getAssignments().then((res) => setAssignments(res.assignments || [])).catch(() => setMapLoadError(true));
  }, [propZones, propPriorities, propResources, floodLevelPercent]);

  const zones = propZones && propZones.length > 0 ? propZones : internalZones;
  const priorities = propPriorities && propPriorities.length > 0 ? propPriorities : internalPriorities;
  const resources = propResources && propResources.length > 0 ? propResources : internalResources;
  const shelters = propShelters && propShelters.length > 0 ? propShelters : internalShelters;
  const blockedRoads = propBlockedRoads && propBlockedRoads.length > 0 ? propBlockedRoads : internalBlockedRoads;
  const visiblePriorities = priorities.slice(0, 150);
  const displayedTotal = propPriorities && propPriorities.length > 0 ? propPriorities.length : priorityTotal;

  const getPriorityColor = (item: PriorityItem) => {
    if (item.priority_score >= 70) return "#ef4444"; // Red for critical
    if (item.priority_score >= 45) return "#f97316"; // Orange for high
    if (item.priority_score >= 25) return "#eab308"; // Yellow for medium
    return "#22c55e"; // Green for low
  };

  const assignmentColor = (type: string) => ({
    boat: "#22d3ee", truck: "#f59e0b", ambulance: "#f43f5e", volunteer_team: "#34d399",
  }[type.toLowerCase()] || "#a78bfa");

  const getZoneStyle = (feature: any) => {
    const isSilent = feature?.properties?.is_silent_zone;
    const depth = feature?.properties?.hazard_forecast?.depth_m_forecast || 0.0;

    let style: L.PathOptions;
    if (depth >= 1.2) {
      style = {
        fillColor: "#dc2626",
        weight: 2,
        opacity: 0.8,
        color: "#f87171",
        fillOpacity: 0.35,
      };
    } else if (depth >= 0.6) {
      style = {
        fillColor: "#ea580c",
        weight: 1.5,
        opacity: 0.8,
        color: "#fb923c",
        fillOpacity: 0.25,
      };
    } else {
      style = {
        fillColor: "#2563eb",
        weight: 1.5,
        opacity: 0.7,
        color: "#60a5fa",
        fillOpacity: 0.15,
      };
    }
    // Purple dashed outline shows missing information; the fill stays tied to
    // forecast depth so uncertainty never hides the flood signal.
    return isSilent ? { ...style, weight: 2, color: "#c084fc", dashArray: "4, 6" } : style;
  };

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-slate-800 shadow-inner">
      <MapContainer
        center={[24.8607, 67.01]}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* OpenStreetMap Layer (100% Free, No Watermarks, No API Key Required) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Waterway exposure layer: synthetic hackathon data now, replaceable with OSM later. */}
        {mapLayers.waterways && waterways.map((waterway) => (
          <GeoJSON
            key={waterway.id}
            data={{ type: "Feature", properties: waterway, geometry: waterway.geometry } as any}
            style={{ color: "#38bdf8", weight: waterway.kind === "coast" ? 4 : 3, opacity: 0.9 }}
            onEachFeature={(_, layer) => layer.bindPopup(`<b>${waterway.name}</b><br/>${waterway.kind.toUpperCase()} exposure layer`)}
          />
        ))}

        {/* Zones Polygons Layer */}
        {mapLayers.zones &&
          zones.map((zone) => (
            <GeoJSON
              key={zone.id}
              data={
                {
                  type: "Feature",
                  properties: zone,
                  geometry: zone.geometry,
                } as any
              }
              style={() => getZoneStyle({ properties: zone })}
              onEachFeature={(feature, layer) => {
                const z = (feature as any).properties as ZoneItem;
                const popupContent = `
                  <div style="font-size: 12px; color: #f8fafc;">
                    <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #38bdf8;">
                      ${z.name} ${z.is_silent_zone ? `<span style="color: #c084fc; font-size: 10px; border: 1px solid #c084fc; padding: 1px 4px; border-radius: 4px;">${UI_COPY.terms.silentArea}</span>` : ''}
                    </div>
                    <div><b>${UI_COPY.terms.floodRisk}:</b> ${z.hazard_forecast?.depth_m_forecast}m</div>
                    <div><b>Time until expected:</b> about ${z.hazard_forecast?.eta_hours} hours</div>
                    <div><b>Ground height:</b> ${z.elevation_m}m</div>
                    <div><b>Reports received:</b> ${z.report_count}</div>
                  </div>
                `;
                layer.bindPopup(popupContent);
              }}
            />
          ))}

        {/* Blocked Roads Layer */}
        {mapLayers.blockedRoads &&
          blockedRoads.map((road) => (
            <Polyline
              key={road.id}
              positions={road.coords.map(([lng, lat]) => [lat, lng])}
              color="#ef4444"
              weight={5}
              dashArray="6, 8"
              opacity={0.9}
            >
              <Popup>
                <div className="text-xs text-slate-100">
                <div className="font-bold text-rose-400 mb-1">Blocked road: {road.name}</div>
                  <span className="inline-block rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold text-amber-300">SIMULATED</span>
                  <div>Status: {road.status.toUpperCase()}</div>
                <div>Water level: {road.depth_m}m</div>
                </div>
              </Popup>
            </Polyline>
          ))}

        {/* Shelters Layer */}
        {mapLayers.shelters &&
          shelters.map((s) => (
            <Marker key={s.id} position={[s.location.lat, s.location.lng]}>
              <Popup>
                <div className="text-xs text-slate-100">
                  <div className="font-bold text-blue-400 mb-1">Safe shelter: {s.name}</div>
                  <div>Capacity: {s.capacity} beds</div>
                  <div>Occupancy: {s.current_occupancy} ({s.occupancy_rate}%)</div>
                  <div>Accessible: {s.accessible ? "Yes (Ground Accessible)" : "Restricted Access"}</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Rescue Resources Layer */}
        {mapLayers.resources &&
          resources.map((r) => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]}>
              <Popup>
                <div className="text-xs text-slate-100">
                  <div className="font-bold text-emerald-400 mb-1">
                    Rescue team: {r.name}
                  </div>
                  <div>Type: {r.type.toUpperCase()}</div>
                  <div>Capacity: {r.capacity} persons</div>
                  <div>Status: {r.status.toUpperCase()}</div>
                  <div>Medical Certified: {r.medical_capable ? "Yes" : "No"}</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {mapLayers.resources && assignments.map((assignment) => (
          <Polyline
            key={assignment.id}
            positions={[
              [assignment.resource_location.lat, assignment.resource_location.lng],
              [assignment.target_location.lat, assignment.target_location.lng],
            ]}
            color={assignmentColor(assignment.resource_type)}
            weight={3}
            opacity={0.85}
          >
            <Popup>
              <div className="text-xs text-slate-100">
                <strong>{assignment.resource_name}</strong> to {assignment.target_id}<br />
                {UI_COPY.terms.estimatedArrival}: {assignment.transit_time_min} min
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Households Priority Pins */}
        {mapLayers.households &&
          visiblePriorities.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.location.lat, p.location.lng]}
              radius={p.priority_score >= 70 ? 7 : 5}
              fillColor={getPriorityColor(p)}
              color="#ffffff"
              weight={1}
              opacity={0.8}
              fillOpacity={0.85}
              eventHandlers={{
                click: () => {
                  setSelectedPriority(p);
                  if (onSelectPriority) onSelectPriority(p);
                },
              }}
            >
              <Popup>
                <div className="text-xs text-slate-100">
                  <div className="font-bold text-white mb-0.5">{p.id} ({p.zone_name})</div>
                  <div className="my-1"><RiskBadge score={p.priority_score} compact /></div>
                  <div className="font-bold text-slate-200" title={UI_COPY.terms.helpPriorityHelp}>{UI_COPY.terms.helpPriority}: {p.priority_score}/100</div>
                  {p.is_silent_zone && <div className="mt-1 flex items-center gap-1 text-purple-200"><CircleHelp aria-hidden="true" className="h-3 w-3" />{UI_COPY.risk.uncertain}</div>}
                  <div>Age: {p.age} {p.mobility_impaired && "| Needs help moving"} {p.chronic_medical_need && "| Medical help needed"}</div>
                  <div title={UI_COPY.terms.peopleNotReachedHelp}>{UI_COPY.terms.peopleNotReached}: {Math.round(p.warning_gap * 100)}%</div>
                  {p.water_proximity_m != null && <div>Nearest waterway: {Math.round(p.water_proximity_m)}m</div>}
                  <button
                    onClick={() => {
                      setSelectedPriority(p);
                      if (onSelectPriority) onSelectPriority(p);
                    }}
                    className="mt-1.5 w-full bg-blue-600 text-white py-1 px-2 rounded font-semibold text-2xs hover:bg-blue-500"
                  >
                    {UI_COPY.actions.viewDetails}
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>

      {mapLoadError && <div className="absolute left-1/2 top-3 z-[1000] w-[min(90%,28rem)] -translate-x-1/2"><PageState kind="error" title={UI_COPY.status.mapError} message={UI_COPY.status.mapPartialError} /></div>}

      {/* Floating Map Legend & Layer Toggles */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 space-y-1.5 shadow-xl">
        <div className="font-bold text-white text-sm">{UI_COPY.map.legendTitle}</div>
        <p className="max-w-56 text-[11px] leading-snug text-slate-200">{UI_COPY.map.pinHelp}</p>
        {displayedTotal > visiblePriorities.length && (
          <div className="rounded bg-amber-500/10 px-1.5 py-1 text-[10px] font-semibold text-amber-200 border border-amber-500/30">
            {UI_COPY.map.showingPins(visiblePriorities.length, displayedTotal)}
          </div>
        )}
        <div className="border-t border-slate-700 pt-1 text-[11px] font-semibold text-white">Household help priority</div>
        <div className="flex items-center justify-between gap-2"><RiskBadge score={70} compact /><span>70+</span></div>
        <div className="flex items-center justify-between gap-2"><RiskBadge score={45} compact /><span>45-69</span></div>
        <div className="flex items-center justify-between gap-2"><RiskBadge score={25} compact /><span>25-44</span></div>
        <div className="flex items-center justify-between gap-2"><RiskBadge score={24} compact /><span>0-24</span></div>
        <div className="border-t border-slate-700 pt-1 text-[11px] font-semibold text-white">Forecast water depth</div>
        <div className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-red-600" />{UI_COPY.map.deepWater}</div>
        <div className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-orange-600" />{UI_COPY.map.risingWater}</div>
        <div className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-blue-600" />{UI_COPY.map.lowerWater}</div>
        <div className="flex items-center gap-1.5">
          <CircleHelp aria-hidden="true" className="h-3.5 w-3.5 text-purple-300" />
          <span>{UI_COPY.map.fewReports}</span>
        </div>
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500"></span>
          <span>{UI_COPY.map.blockedRoad}</span>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[9px] font-bold text-amber-300">SIMULATED</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>{UI_COPY.map.householdPins}</span>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[9px] font-bold text-amber-300">SYNTHETIC</span>
        </div>
      </div>
    </div>
  );
}
