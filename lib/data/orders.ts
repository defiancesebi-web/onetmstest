import { Prisma } from "@/lib/generated/prisma/client";
import type { Currency, StopType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { getEurRate } from "@/lib/bnr";

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

// Postgres serializes concurrent inserts that collide on the same unique key: the
// losers block on the winner's row lock, then fail together with P2002 once the
// winner commits, and retry together against the now-visible max. Each such round
// removes exactly one contender, so N callers racing for the same (companyId, year)
// need at most N attempts to all resolve deterministically — this is not a
// probabilistic retry budget. 8 comfortably covers realistic dispatcher concurrency
// for one company.
const MAX_NUMBERING_ATTEMPTS = 8;

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
  const year = new Date().getFullYear();

  // The unique constraint on (companyId, year, sequence) is the real guard against
  // two concurrent creates claiming one number; a lost race retries once.
  for (let attempt = 0; attempt < MAX_NUMBERING_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
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
      throw error;
    }
  }

  throw new OrderNumberingError();
}
