import type { DocumentType, VehicleType } from "@/lib/generated/prisma/enums";

export const EXPIRY_WARNING_DAYS = 30;

export type DocumentStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";
export type OwnerDocumentStatus = DocumentStatus | "NO_DOCUMENTS";

/**
 * Prisma returns `@db.Date` columns as a Date at UTC midnight, so reading the
 * UTC parts gives back exactly the stored calendar day. Using local getters
 * here would shift the day for any server west of UTC.
 */
export function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Renders a "YYYY-MM-DD" date key the way Romanian users expect: "DD.MM.YYYY". */
export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * "Today" is a Romanian calendar day, not the server's. Vercel runs UTC, so
 * between midnight and 03:00 Bucharest time the two disagree — and a document
 * would read as valid for three hours after it expired.
 */
export function todayKeyInBucharest(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function daysBetweenKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export function documentStatus(expiresAt: Date, now: Date = new Date()): DocumentStatus {
  const todayKey = todayKeyInBucharest(now);
  const expiryKey = toDateKey(expiresAt);

  if (expiryKey < todayKey) return "EXPIRED";

  // A document expiring today is still valid today — it counts as a warning,
  // not as expired.
  return daysBetweenKeys(todayKey, expiryKey) <= EXPIRY_WARNING_DAYS
    ? "EXPIRING_SOON"
    : "VALID";
}

const SEVERITY: Record<DocumentStatus, number> = {
  EXPIRED: 3,
  EXPIRING_SOON: 2,
  VALID: 1,
};

export function aggregateOwnerStatus(statuses: DocumentStatus[]): OwnerDocumentStatus {
  if (statuses.length === 0) return "NO_DOCUMENTS";
  return statuses.reduce((worst, current) =>
    SEVERITY[current] > SEVERITY[worst] ? current : worst
  );
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  EXPIRED: "Expirat",
  EXPIRING_SOON: "Expiră curând",
  VALID: "În regulă",
};

export const OWNER_STATUS_LABELS: Record<OwnerDocumentStatus, string> = {
  ...DOCUMENT_STATUS_LABELS,
  NO_DOCUMENTS: "Fără documente",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ITP: "ITP",
  RCA: "RCA",
  CASCO: "CASCO",
  ROVINIETA: "Rovinietă",
  TAHOGRAF: "Verificare tahograf",
  COPIE_CONFORMA: "Copie conformă",
  ASIGURARE_CMR: "Asigurare CMR",
  PERMIS_CONDUCERE: "Permis de conducere",
  ATESTAT_PROFESIONAL: "Atestat profesional",
  CARD_TAHOGRAF: "Card tahograf",
  AVIZ_MEDICAL: "Aviz medical",
  AVIZ_PSIHOLOGIC: "Aviz psihologic",
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  TRACTOR_UNIT: "Cap tractor",
  SEMI_TRAILER: "Semiremorcă",
  RIGID_TRUCK: "Autocamion",
  VAN_3_5T: "Dubă 3.5t",
};

/** Which types the UI offers, depending on what the document is attached to. */
export const VEHICLE_DOCUMENT_TYPES = [
  "ITP",
  "RCA",
  "CASCO",
  "ROVINIETA",
  "TAHOGRAF",
  "COPIE_CONFORMA",
  "ASIGURARE_CMR",
] as const satisfies readonly DocumentType[];

export const DRIVER_DOCUMENT_TYPES = [
  "PERMIS_CONDUCERE",
  "ATESTAT_PROFESIONAL",
  "CARD_TAHOGRAF",
  "AVIZ_MEDICAL",
  "AVIZ_PSIHOLOGIC",
] as const satisfies readonly DocumentType[];
