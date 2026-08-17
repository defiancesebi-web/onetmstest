import { describe, it, expect } from "vitest";
import { parseEurRate, ExchangeRateUnavailableError } from "@/lib/bnr";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd">
  <Header><Publisher>National Bank of Romania</Publisher></Header>
  <Body>
    <Subject>Reference rates</Subject>
    <OrigCurrency>RON</OrigCurrency>
    <Cube date="2026-08-15">
      <Rate currency="AED">1.3550</Rate>
      <Rate currency="EUR">4.9772</Rate>
      <Rate currency="USD">4.2610</Rate>
    </Cube>
  </Body>
</DataSet>`;

describe("parseEurRate", () => {
  it("extrage cursul EUR și data publicării", () => {
    const result = parseEurRate(SAMPLE_XML);
    expect(result.rate).toBe("4.9772");
    expect(result.date).toBe("2026-08-15");
  });

  it("aruncă dacă lipsește cursul EUR", () => {
    const xml = SAMPLE_XML.replace('<Rate currency="EUR">4.9772</Rate>', "");
    expect(() => parseEurRate(xml)).toThrow(ExchangeRateUnavailableError);
  });

  it("aruncă dacă lipsește data", () => {
    const xml = SAMPLE_XML.replace('<Cube date="2026-08-15">', "<Cube>");
    expect(() => parseEurRate(xml)).toThrow(ExchangeRateUnavailableError);
  });

  it("aruncă pe conținut care nu e XML-ul BNR", () => {
    expect(() => parseEurRate("<html>eroare</html>")).toThrow(ExchangeRateUnavailableError);
  });
});
