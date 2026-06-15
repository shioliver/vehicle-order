import type { FleetData, InspectionReport, Vehicle } from '@/types/domain';

export const TEMPORARY_REPORT_LINK_TTL_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'vehicle-fleet-temporary-report-links-v1';

interface TemporaryReportGrant {
  token: string;
  vehicleId: string;
  reportId: string;
  userId: string;
  timestamp: number;
  expiresAt: number;
}

export function parseReportTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const timestamp = Number(normalized);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return null;
  return timestamp;
}

export function isTemporaryReportLinkValid(timestamp: number | null, now = Date.now()) {
  if (timestamp === null) return false;
  const age = now - timestamp;
  return age >= 0 && age <= TEMPORARY_REPORT_LINK_TTL_MS;
}

export function latestReportForVehicle(vehicle: Vehicle | undefined, data: FleetData): InspectionReport | undefined {
  if (!vehicle) return undefined;

  if (vehicle.lastInspectionId) {
    const latest = data.reports.find((report) => report.id === vehicle.lastInspectionId && report.vehicleId === vehicle.id);
    if (latest) return latest;
  }

  return data.reports.find((report) => report.vehicleId === vehicle.id);
}

function readGrants(now = Date.now()): TemporaryReportGrant[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TemporaryReportGrant[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item.expiresAt >= now);
  } catch {
    return [];
  }
}

function writeGrants(grants: TemporaryReportGrant[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(grants));
  } catch {
    // Temporary links are best-effort in local demo storage.
  }
}

function createToken() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTemporaryReportLink(vehicle: Vehicle | undefined, data: FleetData, userId: string | undefined) {
  const report = latestReportForVehicle(vehicle, data);
  if (!vehicle || !report || !userId) return null;

  const timestamp = Date.now();
  const grant: TemporaryReportGrant = {
    token: createToken(),
    vehicleId: vehicle.id,
    reportId: report.id,
    userId,
    timestamp,
    expiresAt: timestamp + TEMPORARY_REPORT_LINK_TTL_MS
  };
  writeGrants([...readGrants(timestamp), grant]);

  return {
    report,
    href: `/user/rentals/${encodeURIComponent(vehicle.id)}/report/${timestamp}?reportId=${encodeURIComponent(report.id)}&token=${encodeURIComponent(grant.token)}`
  };
}

export function validateTemporaryReportGrant(input: {
  vehicleId: string;
  reportId: string;
  token: string;
  userId: string | undefined;
  timestamp: number | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  if (!input.userId || !isTemporaryReportLinkValid(input.timestamp, now)) return false;
  return readGrants(now).some(
    (grant) =>
      grant.vehicleId === input.vehicleId &&
      grant.reportId === input.reportId &&
      grant.token === input.token &&
      grant.userId === input.userId &&
      grant.timestamp === input.timestamp
  );
}
