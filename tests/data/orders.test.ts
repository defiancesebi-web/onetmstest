import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createOrder, InvalidOrderError, formatOrderNumber } from "@/lib/data/orders";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompanyWithClient(companyName: string, cui: string) {
  const company = await prisma.company.create({ data: { name: companyName, cui } });
  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      name: `Client ${companyName}`,
      cui: `${cui}-C`,
      address: "Str. 1",
      city: "Ploiești",
      paymentTermDays: 30,
    },
  });
  return { company, client, session: { role: "COMPANY_ADMIN" as const, companyId: company.id } };
}

const stops = [
  {
    type: "LOADING" as const,
    address: "Str. Depozit 1",
    city: "Ploiești",
    scheduledDate: new Date("2026-09-01"),
  },
  {
    type: "UNLOADING" as const,
    address: "Str. Fabricii 5",
    city: "Timișoara",
    scheduledDate: new Date("2026-09-02"),
  },
];

function orderInput(companyId: string, clientId: string, overrides = {}) {
  return {
    companyId,
    clientId,
    clientReference: "REF-100",
    cargoDescription: "Paleți cu marfă generală",
    salePrice: "1000.00",
    currency: "RON" as const,
    paymentTermDays: 30,
    stops,
    ...overrides,
  };
}

describe("formatOrderNumber", () => {
  it("compune numărul cu secvența pe patru cifre", () => {
    expect(formatOrderNumber(2026, 1)).toBe("2026-0001");
    expect(formatOrderNumber(2026, 42)).toBe("2026-0042");
    expect(formatOrderNumber(2026, 1234)).toBe("2026-1234");
  });
});

describe("createOrder", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează comanda cu status NEW și opririle în ordine", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const order = await createOrder(session, orderInput(company.id, client.id));

    expect(order.status).toBe("NEW");
    expect(order.orderNumber).toBe(`${new Date().getFullYear()}-0001`);
    expect(order.stops).toHaveLength(2);
    expect(order.stops[0].sequence).toBe(1);
    expect(order.stops[0].type).toBe("LOADING");
    expect(order.stops[1].sequence).toBe(2);
    expect(order.stops[1].type).toBe("UNLOADING");
  });

  it("numerotează secvențial în cadrul firmei", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const first = await createOrder(session, orderInput(company.id, client.id));
    const second = await createOrder(session, orderInput(company.id, client.id));

    expect(second.sequence).toBe(first.sequence + 1);
  });

  it("numerotează independent pentru fiecare firmă", async () => {
    const a = await makeCompanyWithClient("Firma A", "RO1");
    const b = await makeCompanyWithClient("Firma B", "RO2");

    await createOrder(a.session, orderInput(a.company.id, a.client.id));
    const orderB = await createOrder(b.session, orderInput(b.company.id, b.client.id));

    expect(orderB.sequence).toBe(1);
  });

  it("nu dă același număr la două comenzi create simultan", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const results = await Promise.all([
      createOrder(session, orderInput(company.id, client.id)),
      createOrder(session, orderInput(company.id, client.id)),
      createOrder(session, orderInput(company.id, client.id)),
    ]);

    const numbers = results.map((o) => o.orderNumber);
    expect(new Set(numbers).size).toBe(3);
  });

  it("pentru RON folosește cursul 1 și nu apelează BNR", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const order = await createOrder(session, orderInput(company.id, client.id));

    expect(order.exchangeRate.toString()).toBe("1");
    expect(order.salePriceRon.toString()).toBe("1000");
  });

  it("pentru EUR calculează echivalentul în RON cu cursul dat manual", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const order = await createOrder(
      session,
      orderInput(company.id, client.id, {
        salePrice: "1000.00",
        currency: "EUR",
        manualExchangeRate: "4.9772",
        manualExchangeRateDate: new Date("2026-08-15"),
      })
    );

    expect(order.exchangeRate.toString()).toBe("4.9772");
    expect(order.salePriceRon.toString()).toBe("4977.2");
  });

  it("respinge o comandă fără încărcare", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    await expect(
      createOrder(
        session,
        orderInput(company.id, client.id, { stops: [stops[1]] })
      )
    ).rejects.toThrow(InvalidOrderError);
  });

  it("respinge o comandă fără descărcare", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    await expect(
      createOrder(
        session,
        orderInput(company.id, client.id, { stops: [stops[0]] })
      )
    ).rejects.toThrow(InvalidOrderError);
  });

  it("respinge crearea unei comenzi pentru altă firmă", async () => {
    const a = await makeCompanyWithClient("Firma A", "RO1");
    const b = await makeCompanyWithClient("Firma B", "RO2");

    await expect(
      createOrder(a.session, orderInput(b.company.id, b.client.id))
    ).rejects.toThrow(TenantAccessError);
  });

  it("respinge un client care aparține altei firme", async () => {
    const a = await makeCompanyWithClient("Firma A", "RO1");
    const b = await makeCompanyWithClient("Firma B", "RO2");

    await expect(
      createOrder(a.session, orderInput(a.company.id, b.client.id))
    ).rejects.toThrow(InvalidOrderError);
  });

  it("respinge un client dezactivat", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");
    await prisma.client.update({ where: { id: client.id }, data: { isActive: false } });

    await expect(
      createOrder(session, orderInput(company.id, client.id))
    ).rejects.toThrow(InvalidOrderError);
  });
});
