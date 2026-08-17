import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";

describe("stocarea sumelor ca Decimal", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("păstrează exact bănuții, fără erori de virgulă mobilă", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Client",
        cui: "RO2",
        address: "Str. 1",
        city: "Ploiești",
      },
    });

    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        year: 2026,
        sequence: 1,
        orderNumber: "2026-0001",
        clientId: client.id,
        clientReference: "REF-1",
        cargoDescription: "Paleți",
        salePrice: "1234.56",
        currency: "EUR",
        exchangeRate: "4.9772",
        exchangeRateDate: new Date("2026-08-17"),
        salePriceRon: "6144.72",
        paymentTermDays: 45,
      },
    });

    expect(order.salePrice.toString()).toBe("1234.56");
    expect(order.exchangeRate.toString()).toBe("4.9772");
    expect(order.salePriceRon.toString()).toBe("6144.72");
  });
});
