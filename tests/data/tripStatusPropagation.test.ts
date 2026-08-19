import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createTrip, attachOrderToTrip, updateTripStatus } from "@/lib/data/trips";
import { createOrder, updateOrderStatus } from "@/lib/data/orders";
import { InvalidTripStatusTransitionError } from "@/lib/tripStatus";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setupWithOrder(name: string, cui: string) {
  const company = await prisma.company.create({ data: { name, cui } });
  const client = await prisma.client.create({
    data: { companyId: company.id, name: "Client", cui: `${cui}-C`, address: "A", city: "B" },
  });
  const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

  const order = await createOrder(session, {
    companyId: company.id,
    clientId: client.id,
    clientReference: "REF-1",
    cargoDescription: "Marfă",
    salePrice: "1000.00",
    currency: "RON",
    paymentTermDays: 45,
    stops: [
      { type: "LOADING", address: "A", city: "X", scheduledDate: d("2026-09-03") },
      { type: "UNLOADING", address: "B", city: "Y", scheduledDate: d("2026-09-05") },
    ],
  });
  await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });

  const trip = await createTrip(session, {
    companyId: company.id,
    startsAt: d("2026-09-01"),
    endsAt: d("2026-09-01"),
  });
  await attachOrderToTrip(session, trip.id, order.id);

  return { company, client, session, order, trip };
}

describe("updateTripStatus", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("pornirea cursei mută comenzile confirmate în execuție", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");

    await updateTripStatus(session, trip.id, "IN_PROGRESS");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("IN_PROGRESS");
  });

  it("încheierea cursei mută comenzile în livrate", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");
    await updateTripStatus(session, trip.id, "IN_PROGRESS");

    await updateTripStatus(session, trip.id, "COMPLETED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("DELIVERED");
  });

  it("nu dă înapoi o comandă care a avansat deja singură", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");
    await updateTripStatus(session, trip.id, "IN_PROGRESS");
    // The order raced ahead on its own: delivered, documents in, invoiced.
    await updateOrderStatus(session, order.id, "DELIVERED");
    await updateOrderStatus(session, order.id, "DOCUMENTS_RECEIVED");
    await updateOrderStatus(session, order.id, "INVOICED");

    await updateTripStatus(session, trip.id, "COMPLETED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("INVOICED");
  });

  it("anularea cursei desprinde comenzile fără să le schimbe starea", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");

    await updateTripStatus(session, trip.id, "CANCELLED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.tripId).toBeNull();
    expect(fresh.status).toBe("CONFIRMED");
  });

  it("respinge o tranziție nepermisă", async () => {
    const { session, trip } = await setupWithOrder("Firma A", "RO1");

    await expect(updateTripStatus(session, trip.id, "COMPLETED")).rejects.toThrow(
      InvalidTripStatusTransitionError
    );
  });

  it("respinge schimbarea stării unei curse din altă firmă", async () => {
    const a = await setupWithOrder("Firma A", "RO1");
    const b = await setupWithOrder("Firma B", "RO2");

    await expect(updateTripStatus(a.session, b.trip.id, "IN_PROGRESS")).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("anularea unei comenzi o desprinde din cursă", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("scoate comanda anulată din cursa ei", async () => {
    const { session, order } = await setupWithOrder("Firma A", "RO1");

    await updateOrderStatus(session, order.id, "CANCELLED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("CANCELLED");
    expect(fresh.tripId).toBeNull();
  });
});
