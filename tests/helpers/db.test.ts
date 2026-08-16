import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./db";

describe("resetDatabase", () => {
  it("golește tabelele", async () => {
    await prisma.company.create({ data: { name: "Test", cui: "RO1" } });
    await resetDatabase();
    const count = await prisma.company.count();
    expect(count).toBe(0);
  });
});
