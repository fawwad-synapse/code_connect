import { create } from "zustand";
import { PriorityItem } from "./api";

interface AppState {
  selectedPriority: PriorityItem | null;
  setSelectedPriority: (item: PriorityItem | null) => void;

  activeScenario: string | null;
  setActiveScenario: (scenario: string | null) => void;

  mapLayers: {
    zones: boolean;
    households: boolean;
    shelters: boolean;
    resources: boolean;
    blockedRoads: boolean;
    waterways: boolean;
  };
  toggleLayer: (layer: "zones" | "households" | "shelters" | "resources" | "blockedRoads" | "waterways") => void;

  activeFilters: {
    zoneId: string | null;
    medicalOnly: boolean;
    aloneOnly: boolean;
    lowConfidenceOnly: boolean;
  };
  setFilter: (key: "zoneId" | "medicalOnly" | "aloneOnly" | "lowConfidenceOnly", value: any) => void;
  resetFilters: () => void;

  offlineQueueCount: number;
  setOfflineQueueCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedPriority: null,
  setSelectedPriority: (item) => set({ selectedPriority: item }),

  activeScenario: null,
  setActiveScenario: (scenario) => set({ activeScenario: scenario }),

  mapLayers: {
    zones: true,
    households: true,
    shelters: true,
    resources: true,
    blockedRoads: true,
    waterways: true,
  },
  toggleLayer: (layer) =>
    set((state) => ({
      mapLayers: {
        ...state.mapLayers,
        [layer]: !state.mapLayers[layer],
      },
    })),

  activeFilters: {
    zoneId: null,
    medicalOnly: false,
    aloneOnly: false,
    lowConfidenceOnly: false,
  },
  setFilter: (key, value) =>
    set((state) => ({
      activeFilters: {
        ...state.activeFilters,
        [key]: value,
      },
    })),
  resetFilters: () =>
    set({
      activeFilters: {
        zoneId: null,
        medicalOnly: false,
        aloneOnly: false,
        lowConfidenceOnly: false,
      },
    }),

  offlineQueueCount: 0,
  setOfflineQueueCount: (count) => set({ offlineQueueCount: count }),
}));
