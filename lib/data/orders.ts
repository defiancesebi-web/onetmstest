import { Prisma } from "@/lib/generated/prisma/client";
import type { Currency, OrderStatus, StopType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { getEurRate } from "@/lib/bnr";
import { assertTransitionAllowed } from "@/lib/orderStatus";

export class InvalidOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderError";
  }
}

export class OrderNumberingError extends Error {
  constructor() {
    super("Nu s-a putut aloca un număr de comandă. Încearcă din nou.");
    this.name = "OrderNumberingError";
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Comanda nu a fost găsită.");
    this.name = "OrderNotFoundError";
  }
}

export type CreateStopInput = {
  type: StopType;
  locationName?: string | null;
  address: string;
  city: string;
  country?: string;
  scheduledDate: Date;
  timeFrom?: string | null;
  timeTo?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
};

export type CreateOrderInput = {
  companyId: string;
  clientId: string;
  clientReference: string;
  cargoDescription: string;
  cargoWeightKg?: string | null;
  cargoPackaging?: string | null;
  salePrice: string;
  currency: Currency;
  estimatedCostRon?: string | null;
  paymentTermDays: number;
  notes?: string | null;
  stops: CreateStopInput[];
  /** Supplied by the UI when BNR is unreachable and the user typed the rate. */
  manualExchangeRate?: string;
  manualExchangeRateDate?: Date;
};

export type OrderWithStops = Prisma.OrderGetPayload<{ include: { stops: true } }>;

export function formatOrderNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}

function assertStopsValid(stops: CreateStopInput[]) {
  if (!stops.some((s) => s.type === "LOADING")) {
    throw new InvalidOrderError("Comanda trebuie să aibă cel puțin o încărcare.");
  }
  if (!stops.some((s) => s.type === "UNLOADING")) {
    throw new InvalidOrderError("Comanda trebuie să aibă cel puțin o descărcare.");
  }
}

async function resolveRate(input: CreateOrderInput): Promise<{ rate: string; date: Date }> {
  if (input.currency === "RON") {
    return { rate: "1", date: new Date() };
  }
  if (input.manualExchangeRate) {
    return {
      rate: input.manualExchangeRate,
      date: input.manualExchangeRateDate ?? new Date(),
    };
  }
  const { rate, date } = await getEurRate();
  return { rate, date: new Date(date) };
}

/**
 * Year-scoped sequential numbering is a Romanian accounting requirement, so the
 * year boundary must follow Romanian local time, not the server's. A server
 * running in UTC (e.g. Vercel) would otherwise stamp an order created between
 * 00:00 and 02:00/03:00 Bucharest time on 1 January with the previous year.
 * Exported so tests compute the expected year the same way, rather than
 * duplicating (and potentially drifting from) this logic.
 */
export function currentOrderYear(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric" }).format(
      date
    )
  );
}

// The transaction-scoped advisory lock below serializes numbering per
// (companyId, year), so under normal operation at most one caller at a time
// computes+inserts a sequence and P2002 should not occur from legitimate
// concurrency anymore. This retry budget is a defensive backstop, not the
// primary correctness mechanism — the two unique constraints on Order remain
// the real guard against a duplicate number ever being persisted.
export const MAX_NUMBERING_ATTEMPTS = 3;

export async function createOrder(
  session: SessionUser,
  input: CreateOrderInput
): Promise<OrderWithStops> {
  assertCompanyAccess(session, input.companyId);
  assertStopsValid(input.stops);

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client || client.companyId !== input.companyId) {
    throw new InvalidOrderError("Clientul selectat nu aparține firmei tale.");
  }
  if (!client.isActive) {
    throw new InvalidOrderError("Clientul selectat este dezactivat.");
  }

  const { rate, date } = await resolveRate(input);
  const exchangeRate = new Prisma.Decimal(rate);
  const salePrice = new Prisma.Decimal(input.salePrice);
  const salePriceRon = salePrice.mul(exchangeRate).toDecimalPlaces(2);
  const year = currentOrderYear();

  for (let attempt = 0; attempt < MAX_NUMBERING_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Transaction-scoped advisory lock, released automatically on commit or
        // rollback. Serializes number allocation per (companyId, year) across every
        // connection and every process talking to this database, so concurrent
        // callers queue here instead of racing the aggregate-then-insert below.
        // Without this, N concurrent callers can chain into N rounds of
        // collide-then-retry, each holding a transaction (and a pooled connection)
        // open long enough to exhaust the pool wait/transaction timeouts (P2024/P2028).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.companyId}:${year}`}))`;

        const highest = await tx.order.aggregate({
          where: { companyId: input.companyId, year },
          _max: { sequence: true },
        });
        const sequence = (highest._max.sequence ?? 0) + 1;

        return tx.order.create({
          data: {
            companyId: input.companyId,
            year,
            sequence,
            orderNumber: formatOrderNumber(year, sequence),
            clientId: input.clientId,
            clientReference: input.clientReference,
            cargoDescription: input.cargoDescription,
            cargoWeightKg: input.cargoWeightKg ?? null,
            cargoPackaging: input.cargoPackaging ?? null,
            salePrice,
            currency: input.currency,
            exchangeRate,
            exchangeRateDate: date,
            salePriceRon,
            estimatedCostRon: input.estimatedCostRon ?? null,
            paymentTermDays: input.paymentTermDays,
            notes: input.notes ?? null,
            stops: {
              create: input.stops.map((stop, index) => ({
                sequence: index + 1,
                type: stop.type,
                locationName: stop.locationName ?? null,
                address: stop.address,
                city: stop.city,
                country: stop.country ?? "România",
                scheduledDate: stop.scheduledDate,
                timeFrom: stop.timeFrom ?? null,
                timeTo: stop.timeTo ?? null,
                contactName: stop.contactName ?? null,
                contactPhone: stop.contactPhone ?? null,
                notes: stop.notes ?? null,
              })),
            },
          },
          include: { stops: { orderBy: { sequence: "asc" } } },
        });
      });
    } catch (error) {
      const isNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (isNumberCollision && attempt < MAX_NUMBERING_ATTEMPTS - 1) {
        continue;
      }
      if (isNumberCollision) throw new OrderNumberingError();

      // P2024 (pool wait timed out) and P2028 (transaction API error, e.g. the
      // interactive transaction itself timed out) can surface under heavy
      // contention or a starved connection pool. Neither is safe to retry blindly
      // — the resource that's exhausted won't recover by immediately trying
      // again — so translate straight to the Romanian product error instead of
      // letting a raw, English Prisma error reach the user.
      const isResourceExhaustion =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2024" || error.code === "P2028");
      if (isResourceExhaustion) throw new OrderNumberingError();

      throw error;
    }
  }

  throw new OrderNumberingError();
}

export type OrderListItem = Prisma.OrderGetPayload<{
  include: { client: { select: { name: true } } };
}>;

export type OrderWithStopsAndClient = Prisma.OrderGetPayload<{
  include: { stops: true; client: true };
}>;

export type UpdateOrderInput = {
  clientReference?: string;
  cargoDescription?: string;
  cargoWeightKg?: string | null;
  cargoPackaging?: string | null;
  salePrice?: string;
  estimatedCostRon?: string | null;
  paymentTermDays?: number;
  notes?: string | null;
};

export async function listOrders(
  session: SessionUser,
  companyId: string,
  options: { status?: OrderStatus; search?: string; clientId?: string } = {}
): Promise<OrderListItem[]> {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.order.findMany({
    where: {
      companyId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { clientReference: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { client: { select: { name: true } } },
    orderBy: [{ year: "desc" }, { sequence: "desc" }],
  });
}

export async function getOrderById(
  session: SessionUser,
  orderId: string
): Promise<OrderWithStopsAndClient | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { stops: { orderBy: { sequence: "asc" } }, client: true },
  });
  if (!order) return null;
  // Null rather than throw, so pages render 404 without revealing existence.
  if (session.role !== "SUPER_ADMIN" && order.companyId !== session.companyId) {
    return null;
  }
  return order;
}

async function assertOwnOrder(session: SessionUser, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderNotFoundError();
  assertCompanyAccess(session, order.companyId);
  return order;
}

export async function updateOrderStatus(
  session: SessionUser,
  orderId: string,
  to: OrderStatus
) {
  const order = await assertOwnOrder(session, orderId);
  assertTransitionAllowed(order.status, to);

  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: to,
      ...(to === "DOCUMENTS_RECEIVED" && !order.documentsReceivedAt
        ? { documentsReceivedAt: new Date() }
        : {}),
    },
  });
}

export async function updateOrderDetails(
  session: SessionUser,
  orderId: string,
  input: UpdateOrderInput
) {
  const order = await assertOwnOrder(session, orderId);

  // The rate is frozen at creation: a later price edit is converted with the
  // stored rate, never a fresh one.
  const salePriceRon =
    input.salePrice !== undefined
      ? new Prisma.Decimal(input.salePrice).mul(order.exchangeRate).toDecimalPlaces(2)
      : undefined;

  return prisma.order.update({
    where: { id: orderId },
    data: {
      ...input,
      ...(salePriceRon ? { salePriceRon } : {}),
    },
  });
}

export function calculateMargin(order: {
  salePriceRon: Prisma.Decimal | string;
  estimatedCostRon: Prisma.Decimal | string | null;
}): { marginRon: string; marginPercent: string } | null {
  if (order.estimatedCostRon === null) return null;

  const sale = new Prisma.Decimal(order.salePriceRon);
  const cost = new Prisma.Decimal(order.estimatedCostRon);
  const margin = sale.minus(cost);
  const percent = sale.isZero()
    ? new Prisma.Decimal(0)
    : margin.div(sale).mul(100).toDecimalPlaces(1);

  return { marginRon: margin.toString(), marginPercent: percent.toString() };
}
