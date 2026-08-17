import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  createOrder,
  listOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderDetails,
  calculateMargin,
} from "@/lib/data/orders";
import { InvalidStatusTransitionError } from "@/lib/orderStatus";
import { TenantAccessError } from "@/lib/tenancy";

async function setup(companyName: string, cui: string) {
  const company = await prisma.company.create({ data: { name: companyName, cui } });
  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      name: `Client ${companyName}`,
      cui: `${cui}-C`,
      address: "Str. 1",
      city: "Ploiești",
    },
  });
  const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
  const order = await createOrder(session, {
    companyId: company.id,
    clientId: client.id,
    clientReference: "REF-1",
    cargoDescription: "Paleți",
    salePrice: "1000.00",
    currency: "RON",
    estimatedCostRon: "600.00",
    paymentTermDays: 45,
    stops: [
      { type: "LOADING", address: "A", city: "Ploiești", scheduledDate: new Date("2026-09-01") },
      { type: "UNLOADING", address: "B", city: "Arad", scheduledDate: new Date("2026-09-02") },
    ],
  });
  return { company, client, session, order };
}

describe("listOrders", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar comenzile firmei cerute", async () => {
    const a = await setup("Firma A", "RO1");
    await setup("Firma B", "RO2");

    const result = await listOrders(a.session, a.company.id);

    expect(result).toHaveLength(1);
    expect(result[0].orderNumber).toBe(a.order.orderNumber);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(listOrders(a.session, b.company.id)).rejects.toThrow(TenantAccessError);
  });

  it("filtrează după stare", async () => {
    const a = await setup("Firma A", "RO1");

    expect(await listOrders(a.session, a.company.id, { status: "NEW" })).toHaveLength(1);
    expect(await listOrders(a.session, a.company.id, { status: "INVOICED" })).toHaveLength(0);
  });

  it("filtrează după client", async () => {
    const a = await setup("Firma A", "RO1");
    const otherClient = await prisma.client.create({
      data: {
        companyId: a.company.id,
        name: "Alt client",
        cui: "RO-ALT",
        address: "Str. 2",
        city: "Cluj",
      },
    });

    expect(
      await listOrders(a.session, a.company.id, { clientId: a.client.id })
    ).toHaveLength(1);
    expect(
      await listOrders(a.session, a.company.id, { clientId: otherClient.id })
    ).toHaveLength(0);
  });

  it("caută după numărul comenzii și după referința clientului", async () => {
    const a = await setup("Firma A", "RO1");

    expect(await listOrders(a.session, a.company.id, { search: a.order.orderNumber })).toHaveLength(1);
    expect(await listOrders(a.session, a.company.id, { search: "REF-1" })).toHaveLength(1);
    expect(await listOrders(a.session, a.company.id, { search: "inexistent" })).toHaveLength(0);
  });
});

describe("getOrderById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru o comandă din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    expect(await getOrderById(a.session, b.order.id)).toBeNull();
  });

  it("include opririle în ordine și clientul", async () => {
    const a = await setup("Firma A", "RO1");

    const order = await getOrderById(a.session, a.order.id);

    expect(order!.stops.map((s) => s.sequence)).toEqual([1, 2]);
    expect(order!.client.name).toBe("Client Firma A");
  });
});

describe("updateOrderStatus", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("avansează starea când tranziția e permisă", async () => {
    const a = await setup("Firma A", "RO1");

    const updated = await updateOrderStatus(a.session, a.order.id, "CONFIRMED");

    expect(updated.status).toBe("CONFIRMED");
  });

  it("respinge o tranziție nepermisă", async () => {
    const a = await setup("Firma A", "RO1");

    await expect(updateOrderStatus(a.session, a.order.id, "INVOICED")).rejects.toThrow(
      InvalidStatusTransitionError
    );
  });

  it("completează automat data documentelor la trecerea în DOCUMENTS_RECEIVED", async () => {
    const a = await setup("Firma A", "RO1");
    await updateOrderStatus(a.session, a.order.id, "CONFIRMED");
    await updateOrderStatus(a.session, a.order.id, "IN_PROGRESS");
    await updateOrderStatus(a.session, a.order.id, "DELIVERED");

    const updated = await updateOrderStatus(a.session, a.order.id, "DOCUMENTS_RECEIVED");

    expect(updated.documentsReceivedAt).toBeInstanceOf(Date);
  });

  it("respinge schimbarea stării unei comenzi din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(updateOrderStatus(a.session, b.order.id, "CONFIRMED")).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("updateOrderDetails", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("recalculează echivalentul în RON cu cursul stocat, nu cu unul nou", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const client = await prisma.client.create({
      data: { companyId: company.id, name: "C", cui: "RO2", address: "A", city: "B" },
    });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const order = await createOrder(session, {
      companyId: company.id,
      clientId: client.id,
      clientReference: "REF",
      cargoDescription: "Marfă",
      salePrice: "1000.00",
      currency: "EUR",
      manualExchangeRate: "5.0000",
      manualExchangeRateDate: new Date("2026-08-15"),
      paymentTermDays: 45,
      stops: [
        { type: "LOADING", address: "A", city: "X", scheduledDate: new Date("2026-09-01") },
        { type: "UNLOADING", address: "B", city: "Y", scheduledDate: new Date("2026-09-02") },
      ],
    });

    const updated = await updateOrderDetails(session, order.id, { salePrice: "2000.00" });

    expect(updated.exchangeRate.toString()).toBe("5");
    expect(updated.salePriceRon.toString()).toBe("10000");
  });

  it("respinge modificarea unei comenzi din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(
      updateOrderDetails(a.session, b.order.id, { clientReference: "FURAT" })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("calculateMargin", () => {
  it("calculează marja și procentul", () => {
    const result = calculateMargin({ salePriceRon: "1000.00", estimatedCostRon: "600.00" });
    expect(result!.marginRon).toBe("400");
    expect(result!.marginPercent).toBe("40");
  });

  it("returnează null când costul lipsește", () => {
    expect(calculateMargin({ salePriceRon: "1000.00", estimatedCostRon: null })).toBeNull();
  });
});
