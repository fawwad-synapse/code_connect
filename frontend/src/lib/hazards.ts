export type Hazard = "flood" | "heatwave";

export const HAZARDS: Record<Hazard, {
  label: string; icon: string; sliderLabel: string; sliderMin: number;
  sliderMax: number; sliderStep: number; sliderDefault: number; unit: string; accent: string;
}> = {
  flood: { label: "Flood", icon: "🌊", sliderLabel: "Flood level", sliderMin: 0, sliderMax: 100, sliderStep: 1, sliderDefault: 50, unit: "%", accent: "cyan" },
  heatwave: { label: "Heatwave", icon: "☀️", sliderLabel: "Peak heat index", sliderMin: 30, sliderMax: 60, sliderStep: 1, sliderDefault: 42, unit: "°C", accent: "orange" },
};

export function isHazard(value: string | null): value is Hazard {
  return value === "flood" || value === "heatwave";
}
