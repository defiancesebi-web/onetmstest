import type { DocumentType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import {
  documentStatus,
  aggregateOwnerStatus,
  todayKeyInBucharest,
  EXPIRY_WARNING_DAYS,
  type DocumentStatus,
  type OwnerDocumentStatus,
} from "@/lib/documentStatus";

export class DocumentNotFoundError extends Error {
  constructor() {
    super("Documentul nu a fost găsit.");
    this.name = "DocumentNotFoundError";
  }
}

export class InvalidDocumentOwnerError extends Error {
  constructor() {
    super("Documentul trebuie să aparțină fie unui vehicul, fie unui șofer.");
    this.name = "InvalidDocumentOwnerError";
  }
}

export type CreateDocumentInput = {
  vehicleId?: string;
  driverId?: string;
  type: DocumentType;
  number?: string | null;
  issuedAt?: Date | null;
  expiresAt: Date;
  notes?: string | null;
  imageData?: string | null;
};

export type UpdateDocumentInput = {
  type?: DocumentType;
  number?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date;
  notes?: string | null;
  imageData?: string | null;
};

export type ExpiringDocument = {
  id: string;
  type: DocumentType;
  expiresAt: Date;
  status: DocumentStatus;
  ownerLabel: string;
  ownerHref: string;
};

/**
 * Resolves the document's owner, proving it belongs to the session's company,
 * and returns that company's id so the document inherits it. Rejects zero or
 * two owners before touching the database — the DB has the same constraint,
 * but this produces a Romanian message instead of a raw constraint violation.
 */
async function resolveOwnerCompanyId(
  session: SessionUser,
  input: { vehicleId?: string; driverId?: string }
): Promise<string> {
  const hasVehicle = Boolean(input.vehicleId);
  const hasDriver = Boolean(input.driverId);
  if (hasVehicle === hasDriver) throw new InvalidDocumentOwnerError();

  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new InvalidDocumentOwnerError();
    assertCompanyAccess(session, vehicle.companyId);
    return vehicle.companyId;
  }

  const driver = await prisma.driver.findUnique({ where: { id: input.driverId! } });
  if (!driver) throw new InvalidDocumentOwnerError();
  assertCompanyAccess(session, driver.companyId);
  return driver.companyId;
}

async function assertOwnDocument(session: SessionUser, documentId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new DocumentNotFoundError();
  assertCompanyAccess(session, document.companyId);
  return document;
}

export async function createDocument(session: SessionUser, input: CreateDocumentInput) {
  const companyId = await resolveOwnerCompanyId(session, input);

  return prisma.document.create({
    data: {
      companyId,
      vehicleId: input.vehicleId ?? null,
      driverId: input.driverId ?? null,
      type: input.type,
      number: input.number ?? null,
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt,
      notes: input.notes ?? null,
      imageData: input.imageData ?? null,
    },
  });
}

export async function updateDocument(
  session: SessionUser,
  documentId: string,
  input: UpdateDocumentInput
) {
  await assertOwnDocument(session, documentId);
  return prisma.document.update({ where: { id: documentId }, data: input });
}

export async function deleteDocument(session: SessionUser, documentId: string) {
  await assertOwnDocument(session, documentId);
  return prisma.document.delete({ where: { id: documentId } });
}

export async function listDocumentsForVehicle(session: SessionUser, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new DocumentNotFoundError();
  assertCompanyAccess(session, vehicle.companyId);

  return prisma.document.findMany({
    where: { vehicleId },
    orderBy: { expiresAt: "asc" },
  });
}

export async function listDocumentsForDriver(session: SessionUser, driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new DocumentNotFoundError();
  assertCompanyAccess(session, driver.companyId);

  return prisma.document.findMany({
    where: { driverId },
    orderBy: { expiresAt: "asc" },
  });
}

export type DocumentListItem = {
  id: string;
  type: DocumentType;
  number: string | null;
  issuedAt: Date | null;
  expiresAt: Date;
  status: DocumentStatus;
  ownerKind: "vehicle" | "driver" | "company";
  ownerLabel: string;
  ownerHref: string | null;
  imageData: string | null;
};

/** Every document for the company — vehicle, driver and company-level — with
 *  owner labels, computed expiry status and the photo (for the Documents page). */
export async function listAllDocuments(
  session: SessionUser,
  companyId: string
): Promise<DocumentListItem[]> {
  assertCompanyAccess(session, companyId);
  const docs = await prisma.document.findMany({
    where: { companyId },
    include: {
      vehicle: { select: { id: true, registrationNumber: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { expiresAt: "asc" },
  });
  return docs.map((d) => {
    const ownerKind: "vehicle" | "driver" | "company" = d.vehicle
      ? "vehicle"
      : d.driver
        ? "driver"
        : "company";
    return {
      id: d.id,
      type: d.type,
      number: d.number,
      issuedAt: d.issuedAt,
      expiresAt: d.expiresAt,
      status: documentStatus(d.expiresAt),
      ownerKind,
      ownerLabel: d.vehicle
        ? d.vehicle.registrationNumber
        : d.driver
          ? `${d.driver.lastName} ${d.driver.firstName}`.trim()
          : "Firmă",
      ownerHref: d.vehicle
        ? `/dashboard/flota/${d.vehicle.id}`
        : d.driver
          ? `/dashboard/soferi/${d.driver.id}`
          : null,
      imageData: d.imageData,
    };
  });
}

function warningCutoff(now: Date): Date {
  const [year, month, day] = todayKeyInBucharest(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + EXPIRY_WARNING_DAYS));
}

/**
 * One query covers the whole alert: everything expiring on or before the
 * cutoff, which includes anything already expired. Inactive owners are filtered
 * out here rather than in the caller — a sold truck must not nag.
 */
export async function getExpiringDocuments(
  session: SessionUser,
  companyId: string,
  now: Date = new Date()
): Promise<ExpiringDocument[]> {
  assertCompanyAccess(session, companyId);

  const documents = await prisma.document.findMany({
    where: {
      companyId,
      expiresAt: { lte: warningCutoff(now) },
      OR: [{ vehicle: { isActive: true } }, { driver: { isActive: true } }],
    },
    include: {
      vehicle: { select: { id: true, registrationNumber: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { expiresAt: "asc" },
  });

  const rows = documents.map((document) => ({
    id: document.id,
    type: document.type,
    expiresAt: document.expiresAt,
    status: documentStatus(document.expiresAt, now),
    ownerLabel: document.vehicle
      ? document.vehicle.registrationNumber
      : `${document.driver!.firstName} ${document.driver!.lastName}`,
    ownerHref: document.vehicle
      ? `/dashboard/flota/${document.vehicle.id}`
      : `/dashboard/soferi/${document.driver!.id}`,
  }));

  // Expired first, then expiring soon; each group already sorted by date.
  return [
    ...rows.filter((row) => row.status === "EXPIRED"),
    ...rows.filter((row) => row.status === "EXPIRING_SOON"),
  ];
}

/**
 * Aggregate status per owner, for the badge column in the vehicle and driver
 * lists. Includes inactive owners: their page still shows how their documents
 * stood, only the dashboard alert stays quiet about them.
 */
export async function getOwnerStatuses(
  session: SessionUser,
  companyId: string,
  now: Date = new Date()
): Promise<{
  vehicles: Record<string, OwnerDocumentStatus>;
  drivers: Record<string, OwnerDocumentStatus>;
}> {
  assertCompanyAccess(session, companyId);

  const documents = await prisma.document.findMany({
    where: { companyId },
    select: { vehicleId: true, driverId: true, expiresAt: true },
  });

  const byVehicle = new Map<string, DocumentStatus[]>();
  const byDriver = new Map<string, DocumentStatus[]>();

  for (const document of documents) {
    const status = documentStatus(document.expiresAt, now);
    const target = document.vehicleId ? byVehicle : byDriver;
    const key = document.vehicleId ?? document.driverId!;
    target.set(key, [...(target.get(key) ?? []), status]);
  }

  const toRecord = (map: Map<string, DocumentStatus[]>) =>
    Object.fromEntries(
      [...map.entries()].map(([id, statuses]) => [id, aggregateOwnerStatus(statuses)])
    );

  return { vehicles: toRecord(byVehicle), drivers: toRecord(byDriver) };
}
