import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  createTrip,
  attachOrderToTrip,
  updateTripStatus,
  listUnplannedOrders,
} from "@/lib/data/trips";
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

  it("nu desprinde comanda anulată dacă cursa este deja încheiată", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");
    await updateTripStatus(session, trip.id, "IN_PROGRESS");
    await updateTripStatus(session, trip.id, "COMPLETED");
    // Order is now DELIVERED, still attached to the now-COMPLETED trip.

    await updateOrderStatus(session, order.id, "CANCELLED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("CANCELLED");
    expect(fresh.tripId).toBe(trip.id);
  });
});

describe("propagarea la pornirea cursei ignoră comenzile anulate", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("nu atinge o comandă anulată rămasă atașată cursei când aceasta pornește", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");
    // Simulates the state the new detach guard can now leave behind: a
    // CANCELLED order still carrying the trip's id. Written directly rather
    // than through updateOrderStatus because the trip here is PLANNED
    // (editable), so the guarded path would detach it — this test is about
    // the IN_PROGRESS propagation's own filter, not about how such a row
    // could arise.
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });

    await updateTripStatus(session, trip.id, "IN_PROGRESS");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("CANCELLED");
    expect(fresh.tripId).toBe(trip.id);
  });
});

describe("anularea unei curse pornite readuce comenzile la neplanificate", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  // The spec says a cancelled trip's orders "revin la lista neplanificate".
  // Starting the trip has already advanced them to IN_PROGRESS, and the branch
  // forbids moving an order backwards — so the unplanned list and the attach
  // path must accept IN_PROGRESS too, or a broken-down truck strands its
  // orders with no way back onto another one.
  it("lasă comanda atașabilă din nou după ce cursa e anulată din execuție", async () => {
    const { company, session, trip, order } = await setupWithOrder("Firma A", "RO1");
    await updateTripStatus(session, trip.id, "IN_PROGRESS");

    await updateTripStatus(session, trip.id, "CANCELLED");

    const detached = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(detached.tripId).toBeNull();
    expect(detached.status).toBe("IN_PROGRESS");

    const unplanned = await listUnplannedOrders(session, company.id);
    expect(unplanned.map((o) => o.id)).toContain(order.id);

    const replacement = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-03"),
      endsAt: d("2026-09-05"),
    });
    await attachOrderToTrip(session, replacement.id, order.id);

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.tripId).toBe(replacement.id);
    // Re-planning must not have moved the order backwards.
    expect(fresh.status).toBe("IN_PROGRESS");
  });
});
