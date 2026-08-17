import { describe, it, expect } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";
import { multiplyAndRoundToTwoDecimals } from "@/lib/money";

/** The exact operation `createOrder` performs server-side, for comparison. */
function serverRounding(price: string, rate: string): string {
  return new Prisma.Decimal(price).mul(rate).toDecimalPlaces(2).toString();
}

/**
 * `Decimal#toString()` drops trailing zeros ("5000" rather than "5000.00"),
 * unlike our fixed-2-decimal preview. Normalize before comparing so the test
 * checks numeric parity, which is what the finding actually requires — the
 * preview and the saved value must agree on the number, not on formatting.
 */
function normalizeToFixed2(value: string): string {
  const [intPart, fracPart = ""] = value.split(".");
  return `${intPart}.${fracPart.padEnd(2, "0").slice(0, 2)}`;
}

describe("multiplyAndRoundToTwoDecimals", () => {
  it("matches Prisma.Decimal's rounding for the fixture from decimal.test.ts", () => {
    expect(multiplyAndRoundToTwoDecimals("1234.56", "4.9772")).toBe(
      normalizeToFixed2(serverRounding("1234.56", "4.9772"))
    );
    expect(multiplyAndRoundToTwoDecimals("1234.56", "4.9772")).toBe("6144.65");
  });

  it("matches server rounding across a range of values, including half-up ties", () => {
    const cases: [string, string][] = [
      ["1000", "5"],
      ["1000.005", "1"],
      ["100.125", "2"],
      ["0.005", "1"],
      ["999999.99", "1.0001"],
      ["1", "4.9772"],
      ["0", "5"],
    ];

    for (const [price, rate] of cases) {
      expect(multiplyAndRoundToTwoDecimals(price, rate)).toBe(
        normalizeToFixed2(serverRounding(price, rate))
      );
    }
  });

  it("returns null for incomplete or invalid input", () => {
    expect(multiplyAndRoundToTwoDecimals("", "4.9772")).toBeNull();
    expect(multiplyAndRoundToTwoDecimals("100", "")).toBeNull();
    expect(multiplyAndRoundToTwoDecimals("abc", "4.9772")).toBeNull();
    expect(multiplyAndRoundToTwoDecimals("100.", "4.9772")).toBeNull();
  });
});
