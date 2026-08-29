import { Prisma } from "@/lib/generated/prisma/client";
import type { Currency, InvoiceStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { currentOrderYear } from "@/lib/data/orders";
import { DEFAULT_VAT_RATE, INVOICE_UNITS } from "@/lib/invoice-constants";

export class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceValidationError";
  }
}

/** Thrown when issuing needs seller legal data (or a series) the company lacks. */
export class InvoiceIssuerIncompleteError extends Error {
  constructor(missing?: string[]) {
    super(
      missing && missing.length > 0
        ? `Completează în Setări: ${missing.join(", ")} — înainte de a emite factura.`
        : "Completează datele firmei în Setări (serie, sediu) înainte de a emite o factură."
    );
    this.name = "InvoiceIssuerIncompleteError";
  }
}

export class InvoiceNotFoundError extends Error {
  constructor() {
    super("Factura nu a fost găsită.");
    this.name = "InvoiceNotFoundError";
  }
}

export class InvoiceStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceStateError";
  }
}

export type InvoiceLineInput = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
};

export type InvoiceBuyerInput = {
  name: string;
  cui: string;
  regCom: string | null;
  address: string;
  city: string;
  county: string | null;
  country: string;
};

export type CreateInvoiceInput = {
  clientId: string | null;
  buyer: InvoiceBuyerInput;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  exchangeRate: string | null;
  orderIds: string[];
  notes: string | null;
  lines: InvoiceLineInput[];
  /** true → assign a number and mark ISSUED in the same transaction. */
  issueNow: boolean;
};

export { DEFAULT_VAT_RATE, INVOICE_UNITS };

export function formatInvoiceNumber(series: string, number: number): string {
  return `${series}-${String(number).padStart(4, "0")}`;
}

type ComputedLine = {
  description: string;
  unit: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
};

function toDecimal(value: string, field: string): Prisma.Decimal {
  try {
    const d = new Prisma.Decimal(value.trim());
    if (!d.isFinite()) throw new Error("not finite");
    return d;
  } catch {
    throw new InvoiceValidationError(`Valoare numerică invalidă: ${field}.`);
  }
}

/**
 * Turns the raw line inputs into computed money. `vatPayer=false` forces every
 * VAT rate to 0 — a non-VAT-payer never charges VAT regardless of what the form
 * sent. Rounding matches the rest of the app: half-up to 2 decimals, per line,
 * before summing (so the printed total always equals the sum of printed lines).
 */
function computeLines(lines: InvoiceLineInput[], vatPayer: boolean): ComputedLine[] {
  if (lines.length === 0) {
    throw new InvoiceValidationError("Factura are nevoie de cel puțin o linie.");
  }

  return lines.map((line, i) => {
    const label = `linia ${i + 1}`;
    if (!line.description.trim()) {
      throw new InvoiceValidationError(`Completează descrierea la ${label}.`);
    }
    const quantity = toDecimal(line.quantity, `${label} — cantitate`);
    const unitPrice = toDecimal(line.unitPrice, `${label} — preț`);
    if (quantity.lessThanOrEqualTo(0)) {
      throw new InvoiceValidationError(`Cantitatea trebuie să fie pozitivă la ${label}.`);
    }
    if (unitPrice.lessThan(0)) {
      throw new InvoiceValidationError(`Prețul nu poate fi negativ la ${label}.`);
    }
    const vatRate = vatPayer ? toDecimal(line.vatRate || "0", `${label} — TVA`) : new Prisma.Decimal(0);
    if (vatRate.lessThan(0) || vatRate.greaterThan(100)) {
      throw new InvoiceValidationError(`Cota de TVA trebuie să fie între 0 și 100 la ${label}.`);
    }

    const netAmount = quantity.mul(unitPrice).toDecimalPlaces(2);
    const vatAmount = netAmount.mul(vatRate).div(100).toDecimalPlaces(2);
    const grossAmount = netAmount.add(vatAmount);

    return {
      description: line.description.trim(),
      unit: line.unit.trim() || "buc",
      quantity,
      unitPrice,
      vatRate,
      netAmount,
      vatAmount,
      grossAmount,
    };
  });
}

function sumTotals(lines: ComputedLine[]) {
  const zero = new Prisma.Decimal(0);
  const netTotal = lines.reduce((s, l) => s.add(l.netAmount), zero);
  const vatTotal = lines.reduce((s, l) => s.add(l.vatAmount), zero);
  const grossTotal = netTotal.add(vatTotal);
  return { netTotal, vatTotal, grossTotal };
}

function assertIssuerComplete(company: {
  name: string;
  cui: string;
  address: string | null;
  city: string | null;
  invoiceSeries: string | null;
}): asserts company is typeof company & {
  address: string;
  city: string;
  invoiceSeries: string;
} {
  const missing: string[] = [];
  if (!company.invoiceSeries?.trim()) missing.push("serie facturi");
  if (!company.address?.trim()) missing.push("adresă sediu");
  if (!company.city?.trim()) missing.push("oraș");
  if (!company.name?.trim()) missing.push("denumire firmă");
  if (!company.cui?.trim()) missing.push("CUI");
  if (missing.length > 0) {
    throw new InvoiceIssuerIncompleteError(missing);
  }
}

/** The next continuous number within a company's series (issued invoices only). */
async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  series: string
): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${companyId}:${series}`}))`;
  const highest = await tx.invoice.aggregate({
    where: { companyId, series },
    _max: { number: true },
  });
  return (highest._max.number ?? 0) + 1;
}

export async function createInvoice(
  session: SessionUser,
  companyId: string,
  input: CreateInvoiceInput
) {
  assertCompanyAccess(session, companyId);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new InvoiceNotFoundError();

  if (!input.buyer.name.trim() || !input.buyer.cui.trim()) {
    throw new InvoiceValidationError("Cumpărătorul are nevoie de nume și CUI.");
  }

  const computed = computeLines(input.lines, company.vatPayer);
  const totals = sumTotals(computed);

  const exchangeRate =
    input.currency === "RON"
      ? null
      : input.exchangeRate
        ? toDecimal(input.exchangeRate, "curs valutar")
        : null;

  const sellerSnapshot = {
    sellerName: company.name,
    sellerCui: company.cui,
    sellerRegCom: company.regCom,
    sellerAddress: company.address ?? "",
    sellerCity: company.city ?? "",
    sellerCounty: company.county,
    sellerCountry: company.country,
    sellerIban: company.iban,
    sellerBank: company.bankName,
    sellerPhone: company.phone,
    sellerEmail: company.email,
    sellerCapital: company.shareCapital,
    sellerVatPayer: company.vatPayer,
  };

  const buyerSnapshot = {
    clientId: input.clientId,
    buyerName: input.buyer.name.trim(),
    buyerCui: input.buyer.cui.trim(),
    buyerRegCom: input.buyer.regCom?.trim() || null,
    buyerAddress: input.buyer.address.trim(),
    buyerCity: input.buyer.city.trim(),
    buyerCounty: input.buyer.county?.trim() || null,
    buyerCountry: input.buyer.country.trim() || "România",
  };

  const linesData = computed.map((l, i) => ({
    sequence: i + 1,
    description: l.description,
    unit: l.unit,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    vatRate: l.vatRate,
    netAmount: l.netAmount,
    vatAmount: l.vatAmount,
    grossAmount: l.grossAmount,
  }));

  return prisma.$transaction(async (tx) => {
    let numbering: {
      series: string;
      number: number;
      invoiceNumber: string;
      year: number;
      status: InvoiceStatus;
      issuedAt: Date;
    } | null = null;

    if (input.issueNow) {
      assertIssuerComplete(company);
      const number = await nextInvoiceNumber(tx, companyId, company.invoiceSeries);
      numbering = {
        series: company.invoiceSeries,
        number,
        invoiceNumber: formatInvoiceNumber(company.invoiceSeries, number),
        year: currentOrderYear(),
        status: "ISSUED",
        issuedAt: new Date(),
      };
    }

    return tx.invoice.create({
      data: {
        companyId,
        status: numbering?.status ?? "DRAFT",
        year: numbering?.year ?? null,
        series: numbering?.series ?? null,
        number: numbering?.number ?? null,
        invoiceNumber: numbering?.invoiceNumber ?? null,
        issuedAt: numbering?.issuedAt ?? null,
        issueDate: new Date(`${input.issueDate}T00:00:00Z`),
        dueDate: new Date(`${input.dueDate}T00:00:00Z`),
        currency: input.currency,
        exchangeRate,
        orders: input.orderIds.length
          ? { connect: input.orderIds.map((id) => ({ id })) }
          : undefined,
        notes: input.notes?.trim() || null,
        netTotal: totals.netTotal,
        vatTotal: totals.vatTotal,
        grossTotal: totals.grossTotal,
        ...sellerSnapshot,
        ...buyerSnapshot,
        lines: { create: linesData },
      },
    });
  });
}

export type InvoiceListItem = Prisma.InvoiceGetPayload<{
  select: {
    id: true;
    invoiceNumber: true;
    status: true;
    issueDate: true;
    dueDate: true;
    currency: true;
    grossTotal: true;
    buyerName: true;
    efacturaStatus: true;
  };
}>;

export async function listInvoices(
  session: SessionUser,
  companyId: string,
  options: { status?: InvoiceStatus; clientId?: string; search?: string } = {}
): Promise<InvoiceListItem[]> {
  assertCompanyAccess(session, companyId);
  const search = options.search?.trim();

  return prisma.invoice.findMany({
    where: {
      companyId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" } },
              { buyerName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      grossTotal: true,
      buyerName: true,
      efacturaStatus: true,
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getInvoiceById(session: SessionUser, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: { orderBy: { sequence: "asc" } },
      client: { select: { id: true, name: true } },
      orders: { select: { id: true, orderNumber: true }, orderBy: { orderNumber: "asc" } },
    },
  });
  if (!invoice) return null;
  // No SUPER_ADMIN bypass: a platform admin must not read a tenant's invoices.
  if (invoice.companyId !== session.companyId) return null;
  return invoice;
}

export async function issueInvoice(session: SessionUser, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.companyId !== session.companyId) throw new InvoiceNotFoundError();
  if (invoice.status !== "DRAFT") {
    throw new InvoiceStateError("Doar o factură în ciornă poate fi emisă.");
  }

  const company = await prisma.company.findUnique({ where: { id: invoice.companyId } });
  if (!company) throw new InvoiceNotFoundError();
  assertIssuerComplete(company);

  return prisma.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, invoice.companyId, company.invoiceSeries);
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "ISSUED",
        series: company.invoiceSeries,
        number,
        invoiceNumber: formatInvoiceNumber(company.invoiceSeries, number),
        year: currentOrderYear(),
        issuedAt: new Date(),
        // Re-snapshot the seller: the draft may predate filling the firm's data.
        sellerName: company.name,
        sellerCui: company.cui,
        sellerRegCom: company.regCom,
        sellerAddress: company.address ?? "",
        sellerCity: company.city ?? "",
        sellerCounty: company.county,
        sellerCountry: company.country,
        sellerIban: company.iban,
        sellerBank: company.bankName,
        sellerPhone: company.phone,
        sellerEmail: company.email,
        sellerCapital: company.shareCapital,
        sellerVatPayer: company.vatPayer,
      },
    });
  });
}

export async function markInvoicePaid(session: SessionUser, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.companyId !== session.companyId) throw new InvoiceNotFoundError();
  if (invoice.status !== "ISSUED") {
    throw new InvoiceStateError("Doar o factură emisă poate fi marcată ca plătită.");
  }
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date() },
  });
}

export async function cancelInvoice(session: SessionUser, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.companyId !== session.companyId) throw new InvoiceNotFoundError();
  if (invoice.status === "CANCELLED") {
    throw new InvoiceStateError("Factura este deja anulată.");
  }
  // The number is kept (never reused) so the series stays gap-free.
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "CANCELLED" },
  });
}

export async function deleteInvoiceDraft(session: SessionUser, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.companyId !== session.companyId) throw new InvoiceNotFoundError();
  if (invoice.status !== "DRAFT") {
    throw new InvoiceStateError("Doar o ciornă poate fi ștearsă. O factură emisă se anulează.");
  }
  await prisma.invoice.delete({ where: { id: invoiceId } });
}
