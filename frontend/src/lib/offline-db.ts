import { openDB, DBSchema, IDBPDatabase } from "idb";
import { api } from "./api";
import { Hazard } from "./hazards";

interface QueuedReport {
  idempotency_key: string;
  source: string;
  raw_text: string;
  lng?: number;
  lat?: number;
  photo_url?: string;
  queued_at: string;
  synced: boolean;
  hazard?: Hazard;
}

interface RescueRankDB extends DBSchema {
  report_queue: {
    key: string;
    value: QueuedReport;
    indexes: { "by-synced": number };
  };
}

const DB_NAME = "rescuerank_offline_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RescueRankDB>> | null = null;
let syncInProgress: Promise<{ syncedCount: number; errors: number }> | null = null;

function getDB(): Promise<IDBPDatabase<RescueRankDB>> {
  if (typeof window === "undefined") {
    return Promise.reject("IndexedDB unavailable in server environment");
  }
  if (!dbPromise) {
    dbPromise = openDB<RescueRankDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("report_queue")) {
          const store = db.createObjectStore("report_queue", { keyPath: "idempotency_key" });
          store.createIndex("by-synced", "synced");
        }
      },
    });
  }
  return dbPromise;
}

export async function queueOfflineReport(report: {
  source: string;
  raw_text: string;
  lng?: number;
  lat?: number;
  photo_url?: string;
  hazard?: Hazard;
}): Promise<QueuedReport> {
  const db = await getDB();
  const idempotency_key = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const item: QueuedReport = {
    ...report,
    idempotency_key,
    queued_at: new Date().toISOString(),
    synced: false,
  };
  await db.put("report_queue", item);
  return item;
}

export async function getPendingOfflineReports(): Promise<QueuedReport[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("report_queue");
    return all.filter((r) => !r.synced);
  } catch {
    return [];
  }
}

export function syncOfflineReports(): Promise<{ syncedCount: number; errors: number }> {
  if (syncInProgress) return syncInProgress;
  syncInProgress = performOfflineReportSync().finally(() => { syncInProgress = null; });
  return syncInProgress;
}

async function performOfflineReportSync(): Promise<{ syncedCount: number; errors: number }> {
  try {
    const db = await getDB();
    const pending = await getPendingOfflineReports();
    let synced = 0;
    let errors = 0;

    for (const report of pending) {
      try {
        await api.submitReport(
          {
            source: report.source,
            raw_text: report.raw_text,
            lng: report.lng,
            lat: report.lat,
            photo_url: report.photo_url,
          },
          report.idempotency_key,
          report.hazard || "flood"
        );

        // Mark as synced or remove from queue
        await db.delete("report_queue", report.idempotency_key);
        synced += 1;
      } catch (e) {
        errors += 1;
      }
    }

    return { syncedCount: synced, errors };
  } catch (e) {
    return { syncedCount: 0, errors: 1 };
  }
}
