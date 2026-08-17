export const BNR_RATES_URL = "https://www.bnr.ro/nbrfxrates.xml";

export class ExchangeRateUnavailableError extends Error {
  constructor(message = "Cursul BNR nu este disponibil momentan.") {
    super(message);
    this.name = "ExchangeRateUnavailableError";
  }
}

/**
 * Pulls the EUR reference rate out of BNR's daily XML. The document is tiny and
 * has a fixed shape, so two targeted patterns beat pulling in an XML parser.
 */
export function parseEurRate(xml: string): { rate: string; date: string } {
  const dateMatch = xml.match(/<Cube\s+date="(\d{4}-\d{2}-\d{2})"/);
  if (!dateMatch) {
    throw new ExchangeRateUnavailableError("Răspunsul BNR nu conține data cursului.");
  }

  const rateMatch = xml.match(/<Rate\s+currency="EUR"\s*>([\d.]+)<\/Rate>/);
  if (!rateMatch) {
    throw new ExchangeRateUnavailableError("Răspunsul BNR nu conține cursul EUR.");
  }

  return { rate: rateMatch[1], date: dateMatch[1] };
}

let cached: { rate: string; date: string; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * BNR publishes only on business days; the document always carries the latest
 * published rate, so weekend orders correctly use Friday's rate and record
 * Friday's date.
 */
export async function getEurRate(): Promise<{ rate: string; date: string }> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, date: cached.date };
  }

  let xml: string;
  try {
    const response = await fetch(BNR_RATES_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new ExchangeRateUnavailableError(`BNR a răspuns cu status ${response.status}.`);
    }
    xml = await response.text();
  } catch (error) {
    if (error instanceof ExchangeRateUnavailableError) throw error;
    throw new ExchangeRateUnavailableError();
  }

  const parsed = parseEurRate(xml);
  cached = { ...parsed, fetchedAt: Date.now() };
  return parsed;
}
