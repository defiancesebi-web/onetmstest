/**
 * Client-safe invoice constants. Kept out of lib/data/invoices.ts (which imports
 * Prisma, a server-only module) so client components can use them without
 * dragging the Prisma/pg runtime — and its node built-ins — into the browser
 * bundle.
 */
export const DEFAULT_VAT_RATE = "21";
export const INVOICE_UNITS = ["buc", "cursă", "km", "kg", "tonă", "lună", "oră"] as const;
