import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export class DuplicateCuiError extends Error {
  existingClientName: string;

  constructor(existingClientName: string) {
    super(`Există deja un client cu acest CUI: ${existingClientName}.`);
    this.name = "DuplicateCuiError";
    this.existingClientName = existingClientName;
  }
}

export type CreateClientInput = {
  companyId: string;
  name: string;
  cui: string;
  address: string;
  city: string;
  country?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  paymentTermDays?: number;
  notes?: string | null;
  /** Set by the UI on the second submit, after the user accepts the duplicate warning. */
  confirmDuplicateCui?: boolean;
};

export type UpdateClientInput = Partial<
  Omit<CreateClientInput, "companyId" | "confirmDuplicateCui">
>;

export async function findClientsByCui(
  session: SessionUser,
  companyId: string,
  cui: string
) {
  assertCompanyAccess(session, companyId);
  return prisma.client.findMany({ where: { companyId, cui } });
}

export async function listClients(
  session: SessionUser,
  companyId: string,
  options: { search?: string; includeInactive?: boolean } = {}
) {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.client.findMany({
    where: {
      companyId,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { cui: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getClientById(session: SessionUser, clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  // Returns null rather than throwing so pages can render a 404 without
  // distinguishing "does not exist" from "belongs to another company".
  if (session.role !== "SUPER_ADMIN" && client.companyId !== session.companyId) {
    return null;
  }
  return client;
}

export async function createClient(session: SessionUser, input: CreateClientInput) {
  assertCompanyAccess(session, input.companyId);

  if (!input.confirmDuplicateCui) {
    const existing = await findClientsByCui(session, input.companyId, input.cui);
    if (existing.length > 0) {
      throw new DuplicateCuiError(existing[0].name);
    }
  }

  return prisma.client.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      cui: input.cui,
      address: input.address,
      city: input.city,
      country: input.country ?? "România",
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      paymentTermDays: input.paymentTermDays ?? 45,
      notes: input.notes ?? null,
    },
  });
}

async function assertOwnClient(session: SessionUser, clientId: string) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  assertCompanyAccess(session, client.companyId);
  return client;
}

export async function updateClient(
  session: SessionUser,
  clientId: string,
  input: UpdateClientInput
) {
  await assertOwnClient(session, clientId);
  return prisma.client.update({ where: { id: clientId }, data: input });
}

export async function setClientActive(
  session: SessionUser,
  clientId: string,
  isActive: boolean
) {
  await assertOwnClient(session, clientId);
  return prisma.client.update({ where: { id: clientId }, data: { isActive } });
}
