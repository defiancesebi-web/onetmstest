import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createTrip, getTripById, InvalidTripError } from "@/lib/data/trips";
import {
  attachOrderToTrip,
  detachOrderFromTrip,
  listUnplannedOrders,
} from "@/lib/data/trips";
import { createOrder } from "@/lib/data/orders";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setup(name: string, cui: string) {
  const company = await prisma.company.create({ data: { name, cui } });
  const client = await prisma.client.create({
    data: { companyId: company.id, name: "Client", cui: `${cui}-C`, address: "A", city: "B" },
  });
  const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
  return { company, client, session };
}

async function makeOrder(
  session: { role: "COMPANY_ADMIN"; companyId: string },
  companyId: string,
  clientId: string,
  loading: string,
  unloading: string
) {
  return createOrder(session, {
    companyId,
    clientId,
    clientReference: `REF-${loading}`,
    cargoDescription: "Marfă",
    salePrice: "1000.00",
    currency: "RON",
    paymentTermDays: 45,
    stops: [
      { type: "LOADING", address: "A", city: "X", scheduledDate: d(loading) },
      { type: "UNLOADING", address: "B", city: "Y", scheduledDate: d(unloading) },
    ],
  });
}

describe("attachOrderToTrip", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("atașează o comandă confirmată și recalculează intervalul", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await attachOrderToTrip(session, trip.id, order.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.orders).toHaveLength(1);
    expect(fresh!.startsAt.toISOString().slice(0, 10)).toBe("2026-09-03");
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-07");
  });

  it("nu recalculează intervalul dacă a fost editat manual", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-20"),
    });
    await prisma.trip.update({ where: { id: trip.id }, data: { datesEditedManually: true } });

    await attachOrderToTrip(session, trip.id, order.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-20");
  });

  it("întinde intervalul peste mai multe comenzi", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const first = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-05");
    const second = await makeOrder(session, company.id, client.id, "2026-09-02", "2026-09-09");
    await prisma.order.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { status: "CONFIRMED" },
    });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await attachOrderToTrip(session, trip.id, first.id);
    await attachOrderToTrip(session, trip.id, second.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.startsAt.toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("nu inversează intervalul cursei când stopurile comenzii sunt în ordine greșită", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    // A mistyped unloading date: loading 10.09, unloading 01.09. Nothing
    // validates stop chronology today, so the order is stored as typed and
    // the recalc would otherwise write startsAt > endsAt — which makes the
    // trip's resources invisible to overlap detection.
    const order = await makeOrder(session, company.id, client.id, "2026-09-10", "2026-09-01");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    await attachOrderToTrip(session, trip.id, order.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.startsAt.getTime()).toBeLessThanOrEqual(fresh!.endsAt.getTime());
    expect(fresh!.startsAt.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-02");
  });

  it("respinge o comandă care nu e confirmată", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await expect(attachOrderToTrip(session, trip.id, order.id)).rejects.toThrow(InvalidTripError);
  });

  it("atașează o comandă rămasă în execuție după anularea cursei ei", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await attachOrderToTrip(session, trip.id, order.id);

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.tripId).toBe(trip.id);
    expect(fresh.status).toBe("IN_PROGRESS");
  });

  it("respinge o comandă deja livrată", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await expect(attachOrderToTrip(session, trip.id, order.id)).rejects.toThrow(
      /confirmate sau în execuție/
    );
  });

  it("respinge o comandă deja atașată altei curse", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const first = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    const second = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, first.id, order.id);

    await expect(attachOrderToTrip(session, second.id, order.id)).rejects.toThrow(InvalidTripError);
  });

  it("respinge o comandă a altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const orderB = await makeOrder(b.session, b.company.id, b.client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: orderB.id }, data: { status: "CONFIRMED" } });
    const tripA = await createTrip(a.session, { companyId: a.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });

    await expect(attachOrderToTrip(a.session, tripA.id, orderB.id)).rejects.toThrow(
      InvalidTripError
    );
  });

  it("respinge atașarea la o cursă încheiată", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "COMPLETED" } });

    await expect(attachOrderToTrip(session, trip.id, order.id)).rejects.toThrow(InvalidTripError);
  });

  it("respinge atașarea la o cursă anulată", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "CANCELLED" } });

    await expect(attachOrderToTrip(session, trip.id, order.id)).rejects.toThrow(InvalidTripError);
  });

  it("respinge o cursă a altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const orderA = await makeOrder(a.session, a.company.id, a.client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: orderA.id }, data: { status: "CONFIRMED" } });
    const tripB = await createTrip(b.session, { companyId: b.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });

    await expect(attachOrderToTrip(a.session, tripB.id, orderA.id)).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("detachOrderFromTrip", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("desprinde comanda fără să-i schimbe starea", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, trip.id, order.id);

    await detachOrderFromTrip(session, order.id);

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.tripId).toBeNull();
    expect(fresh.status).toBe("CONFIRMED");
  });

  it("respinge desprinderea unei comenzi din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const orderB = await makeOrder(b.session, b.company.id, b.client.id, "2026-09-03", "2026-09-07");

    await expect(detachOrderFromTrip(a.session, orderB.id)).rejects.toThrow(TenantAccessError);
  });

  it("recalculează intervalul la desprinderea comenzii care definește marginea", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const first = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-05");
    const second = await makeOrder(session, company.id, client.id, "2026-09-02", "2026-09-09");
    await prisma.order.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { status: "CONFIRMED" },
    });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, trip.id, first.id);
    await attachOrderToTrip(session, trip.id, second.id);

    // `second` (2026-09-02..09) defines both outer edges of the window; once it
    // is detached only `first` (2026-09-03..05) remains, so the window must
    // shrink to match it rather than staying at the wider two-order range.
    await detachOrderFromTrip(session, second.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.startsAt.toISOString().slice(0, 10)).toBe("2026-09-03");
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-05");
  });

  it("respinge desprinderea dintr-o cursă încheiată", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, trip.id, order.id);
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "COMPLETED" } });

    await expect(detachOrderFromTrip(session, order.id)).rejects.toThrow(InvalidTripError);
  });
});

describe("listUnplannedOrders", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar comenzile confirmate fără cursă", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const planned = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-05");
    const unplanned = await makeOrder(session, company.id, client.id, "2026-09-04", "2026-09-06");
    const notConfirmed = await makeOrder(session, company.id, client.id, "2026-09-05", "2026-09-07");
    await prisma.order.updateMany({
      where: { id: { in: [planned.id, unplanned.id] } },
      data: { status: "CONFIRMED" },
    });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, trip.id, planned.id);

    const result = await listUnplannedOrders(session, company.id);

    expect(result.map((o) => o.id)).toEqual([unplanned.id]);
    expect(result.map((o) => o.id)).not.toContain(notConfirmed.id);
  });

  it("include o comandă rămasă în execuție după anularea cursei ei", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const running = await makeOrder(session, company.id, client.id, "2026-09-04", "2026-09-06");
    const isNew = await makeOrder(session, company.id, client.id, "2026-09-05", "2026-09-07");
    await prisma.order.update({ where: { id: running.id }, data: { status: "IN_PROGRESS" } });

    const result = await listUnplannedOrders(session, company.id);

    expect(result.map((o) => o.id)).toContain(running.id);
    // Business rule 1 keeps its intent: a NEW order still cannot be planned.
    expect(result.map((o) => o.id)).not.toContain(isNew.id);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(listUnplannedOrders(a.session, b.company.id)).rejects.toThrow(TenantAccessError);
  });
});
