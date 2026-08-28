/**
 * Look up a Romanian company by its CUI (fiscal code) via ANAF's free public
 * VAT web service — no account, no key. We only ever send the CUI the
 * dispatcher typed and read back public registry data (name, registered
 * office, reg-com number, VAT status) to prefill the client form.
 *
 * Server-only (uses fetch to an external host). The endpoint occasionally
 * bumps its version; keep ANAF_ENDPOINT easy to change.
 */

const ANAF_ENDPOINT = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v9/ws/tva";

export type AnafCompany = {
  cui: string;
  name: string;
  address: string;
  city: string;
  county: string | null;
  postalCode: string | null;
  phone: string | null;
  regCom: string | null;
  vatPayer: boolean;
  inactive: boolean;
};

export type AnafLookupResult =
  | { ok: true; company: AnafCompany }
  | { ok: false; reason: "invalid" | "notfound" | "unreachable" };

/** Keep only the digits — strips a leading "RO", spaces, dots, dashes. */
export function normalizeCui(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

const LOCALITY_PREFIXES =
  /^(mun\.?|municipiul|or[sș]\.?|ora[sș]ul|ora[sș]|com\.?|comuna|sat)\s+/i;

function cleanLocality(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().replace(LOCALITY_PREFIXES, "").trim();
}

function titleCaseRo(value: string): string {
  const lower = value.toLocaleLowerCase("ro-RO");
  return lower.replace(/(^|[\s-])([\p{L}])/gu, (_m, sep, ch) => sep + ch.toLocaleUpperCase("ro-RO"));
}

type AnafFound = {
  date_generale?: {
    cui?: number | string;
    denumire?: string;
    adresa?: string;
    nrRegCom?: string;
    telefon?: string;
  };
  inregistrare_scop_Tva?: { scpTVA?: boolean };
  stare_inactiv?: { statusInactivi?: boolean };
  adresa_sediu_social?: {
    sdenumire_Strada?: string;
    snumar_Strada?: string;
    sdenumire_Localitate?: string;
    sdenumire_Judet?: string;
    scod_Postal?: string;
    stara?: string;
  };
};

function toCompany(cui: string, found: AnafFound): AnafCompany {
  const g = found.date_generale ?? {};
  const s = found.adresa_sediu_social ?? {};

  // Prefer a clean street line from the registered office; fall back to the
  // full free-text address ANAF returns in date_generale.
  const street = [s.sdenumire_Strada?.trim(), s.snumar_Strada?.trim() ? `nr. ${s.snumar_Strada.trim()}` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  const address = titleCaseRo(street || (g.adresa ?? "").trim());
  const city = titleCaseRo(cleanLocality(s.sdenumire_Localitate));
  const county = s.sdenumire_Judet ? titleCaseRo(cleanLocality(s.sdenumire_Judet)) : null;

  return {
    cui,
    name: (g.denumire ?? "").trim(),
    address,
    city,
    county,
    postalCode: s.scod_Postal?.trim() || null,
    phone: g.telefon?.trim() || null,
    regCom: g.nrRegCom?.trim() || null,
    vatPayer: found.inregistrare_scop_Tva?.scpTVA === true,
    inactive: found.stare_inactiv?.statusInactivi === true,
  };
}

export async function lookupCompanyByCui(rawCui: string): Promise<AnafLookupResult> {
  const cui = normalizeCui(rawCui);
  // Romanian CUIs are 2–10 digits.
  if (cui.length < 2 || cui.length > 10) return { ok: false, reason: "invalid" };

  const today = new Date().toISOString().slice(0, 10); // ANAF rejects future dates

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(ANAF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "ONE-TMS/1.0",
      },
      body: JSON.stringify([{ cui: Number(cui), data: today }]),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: "unreachable" };

    const json = (await res.json()) as { found?: AnafFound[]; notfound?: unknown[] };
    const found = json.found?.[0];
    if (!found) return { ok: false, reason: "notfound" };

    return { ok: true, company: toCompany(cui, found) };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}
