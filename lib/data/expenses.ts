import { Prisma } from "@/lib/generated/prisma/client";
import type {
  FixedCostCategory,
  FixedCostPeriod,
  ExpenseCategory,
} from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export class ExpenseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpenseValidationError";
  }
}
export class ExpenseNotFoundError extends Error {
  constructor() {
    super("Înregistrarea nu a fost găsită.");
    this.name = "ExpenseNotFoundError";
  }
}

function positiveAmount(value: string, field: string): Prisma.Decimal {
  try {
    const d = new Prisma.Decimal(value.trim());
    if (!d.isFinite() || d.lessThanOrEqualTo(0)) throw new Error("not positive");
    return d;
  } catch {
    throw new ExpenseValidationError(`Sumă invalidă: ${field}.`);
  }
}

function optionalDecimal(value: string | null, field: string): Prisma.Decimal | null {
  if (value == null || value.trim() === "") return null;
  try {
    const d = new Prisma.Decimal(value.trim());
    if (!d.isFinite() || d.lessThan(0)) throw new Error("bad");
    return d;
  } catch {
    throw new ExpenseValidationError(`Valoare invalidă: ${field}.`);
  }
}

/* ------------------------------- Fixed costs ------------------------------ */

export type FixedCostInput = {
  label: string;
  category: FixedCostCategory;
  period: FixedCostPeriod;
  amount: string;
  vehicleId: string | null;
  notes: string | null;
};

export async function listFixedCosts(session: SessionUser, companyId: string) {
  assertCompanyAccess(session, companyId);
  return prisma.fixedCost.findMany({
    where: { companyId },
    include: { vehicle: { select: { registrationNumber: true } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

export async function createFixedCost(
  session: SessionUser,
  companyId: string,
  input: FixedCostInput
) {
  assertCompanyAccess(session, companyId);
  if (!input.label.trim()) throw new ExpenseValidationError("Completează denumirea.");
  const amount = positiveAmount(input.amount, "sumă");
  return prisma.fixedCost.create({
    data: {
      companyId,
      label: input.label.trim(),
      category: input.category,
      period: input.period,
      amount,
      vehicleId: input.vehicleId || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateFixedCost(session: SessionUser, id: string, input: FixedCostInput) {
  const existing = await prisma.fixedCost.findUnique({ where: { id } });
  if (!existing || existing.companyId !== session.companyId) throw new ExpenseNotFoundError();
  if (!input.label.trim()) throw new ExpenseValidationError("Completează denumirea.");
  const amount = positiveAmount(input.amount, "sumă");
  return prisma.fixedCost.update({
    where: { id },
    data: {
      label: input.label.trim(),
      category: input.category,
      period: input.period,
      amount,
      vehicleId: input.vehicleId || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function setFixedCostActive(session: SessionUser, id: string, isActive: boolean) {
  const existing = await prisma.fixedCost.findUnique({ where: { id } });
  if (!existing || existing.companyId !== session.companyId) throw new ExpenseNotFoundError();
  return prisma.fixedCost.update({ where: { id }, data: { isActive } });
}

export async function deleteFixedCost(session: SessionUser, id: string) {
  const existing = await prisma.fixedCost.findUnique({ where: { id } });
  if (!existing || existing.companyId !== session.companyId) throw new ExpenseNotFoundError();
  await prisma.fixedCost.delete({ where: { id } });
}

/* ------------------------------- Expenses --------------------------------- */

export type ExpenseInput = {
  date: string;
  category: ExpenseCategory;
  amount: string;
  liters: string | null;
  vehicleId: string | null;
  driverId: string | null;
  tripId: string | null;
  notes: string | null;
};

export async function listExpenses(
  session: SessionUser,
  companyId: string,
  options: { vehicleId?: string; limit?: number } = {}
) {
  assertCompanyAccess(session, companyId);
  return prisma.expense.findMany({
    where: { companyId, ...(options.vehicleId ? { vehicleId: options.vehicleId } : {}) },
    include: {
      vehicle: { select: { registrationNumber: true } },
      driver: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: options.limit ?? 100,
  });
}

export async function createExpense(session: SessionUser, companyId: string, input: ExpenseInput) {
  assertCompanyAccess(session, companyId);
  if (!input.date) throw new ExpenseValidationError("Alege o dată.");
  const amount = positiveAmount(input.amount, "sumă");
  const liters = optionalDecimal(input.liters, "litri");
  return prisma.expense.create({
    data: {
      companyId,
      date: new Date(`${input.date}T00:00:00Z`),
      category: input.category,
      amount,
      liters,
      vehicleId: input.vehicleId || null,
      driverId: input.driverId || null,
      tripId: input.tripId || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function deleteExpense(session: SessionUser, id: string) {
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.companyId !== session.companyId) throw new ExpenseNotFoundError();
  await prisma.expense.delete({ where: { id } });
}

/* --------------------------- Cost-per-km analysis ------------------------- */

export type CostRange = "month" | "year" | "rolling12";
export const COST_RANGES: CostRange[] = ["month", "year", "rolling12"];

export type TractorCost = {
  id: string;
  registrationNumber: string;
  km: number;
  fixed: number;
  variable: number;
  total: number;
  costPerKm: number | null;
};

export type TrailerCost = {
  id: string;
  registrationNumber: string;
  fixed: number;
  variable: number;
  total: number;
};

export type CostAnalysis = {
  range: CostRange;
  months: number;
  fixedMonthly: number;
  fixedTotal: number;
  variableTotal: number;
  totalCost: number;
  totalKm: number;
  costPerKm: number | null;
  fixedByCategory: { category: FixedCostCategory; amount: number }[];
  variableByCategory: { category: ExpenseCategory; amount: number }[];
  tractors: TractorCost[];
  trailers: TrailerCost[];
};

function bucharestYearMonth(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((p) => p.type === "year")!.value),
    month: Number(parts.find((p) => p.type === "month")!.value),
  };
}

/** Window start (UTC midnight) and month multiplier for a cost range. */
function rangeWindow(range: CostRange): { start: Date; months: number } {
  const { year, month } = bucharestYearMonth();
  if (range === "month") return { start: new Date(Date.UTC(year, month - 1, 1)), months: 1 };
  if (range === "year") return { start: new Date(Date.UTC(year, 0, 1)), months: month };
  return { start: new Date(Date.UTC(year, month - 1 - 11, 1)), months: 12 };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function getCostAnalysis(
  session: SessionUser,
  companyId: string,
  range: CostRange
): Promise<CostAnalysis> {
  assertCompanyAccess(session, companyId);
  const { start, months } = rangeWindow(range);

  const [fixedCosts, expenses, trips, vehicles] = await Promise.all([
    prisma.fixedCost.findMany({
      where: { companyId, isActive: true },
      select: { amount: true, period: true, vehicleId: true, category: true },
    }),
    prisma.expense.findMany({
      where: { companyId, date: { gte: start } },
      select: { amount: true, vehicleId: true, category: true },
    }),
    prisma.trip.findMany({
      where: { companyId, startsAt: { gte: start }, distanceKm: { not: null } },
      select: { distanceKm: true, tractorUnitId: true },
    }),
    prisma.vehicle.findMany({
      where: { companyId, isActive: true },
      select: { id: true, registrationNumber: true, type: true },
      orderBy: { registrationNumber: "asc" },
    }),
  ]);

  // A fixed cost's monthly equivalent: a yearly amount is spread over 12 months.
  const monthlyOf = (amount: Prisma.Decimal, period: FixedCostPeriod) =>
    period === "YEARLY" ? Number(amount) / 12 : Number(amount);

  const fixedMonthly = fixedCosts.reduce((s, f) => s + monthlyOf(f.amount, f.period), 0);
  const fixedTotal = fixedMonthly * months;
  const variableTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalCost = fixedTotal + variableTotal;
  const totalKm = trips.reduce((s, t) => s + Number(t.distanceKm ?? 0), 0);

  // Breakdowns by category (fixed as a period total, variable as spent).
  const fixedCatMap = new Map<FixedCostCategory, number>();
  for (const f of fixedCosts) {
    fixedCatMap.set(
      f.category,
      (fixedCatMap.get(f.category) ?? 0) + monthlyOf(f.amount, f.period) * months
    );
  }
  const varCatMap = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    varCatMap.set(e.category, (varCatMap.get(e.category) ?? 0) + Number(e.amount));
  }

  // Per-vehicle direct attribution.
  const kmByTractor = new Map<string, number>();
  for (const t of trips) {
    if (t.tractorUnitId) {
      kmByTractor.set(t.tractorUnitId, (kmByTractor.get(t.tractorUnitId) ?? 0) + Number(t.distanceKm ?? 0));
    }
  }
  const fixedMonthlyByVehicle = new Map<string, number>();
  for (const f of fixedCosts) {
    if (f.vehicleId) {
      fixedMonthlyByVehicle.set(
        f.vehicleId,
        (fixedMonthlyByVehicle.get(f.vehicleId) ?? 0) + monthlyOf(f.amount, f.period)
      );
    }
  }
  const variableByVehicle = new Map<string, number>();
  for (const e of expenses) {
    if (e.vehicleId) {
      variableByVehicle.set(e.vehicleId, (variableByVehicle.get(e.vehicleId) ?? 0) + Number(e.amount));
    }
  }

  const tractors: TractorCost[] = vehicles
    .filter((v) => v.type !== "SEMI_TRAILER")
    .map((v) => {
      const km = round2(kmByTractor.get(v.id) ?? 0);
      const fixed = round2((fixedMonthlyByVehicle.get(v.id) ?? 0) * months);
      const variable = round2(variableByVehicle.get(v.id) ?? 0);
      const total = round2(fixed + variable);
      return {
        id: v.id,
        registrationNumber: v.registrationNumber,
        km,
        fixed,
        variable,
        total,
        costPerKm: km > 0 ? round2(total / km) : null,
      };
    })
    .filter((t) => t.total > 0 || t.km > 0);

  const trailers: TrailerCost[] = vehicles
    .filter((v) => v.type === "SEMI_TRAILER")
    .map((v) => {
      const fixed = round2((fixedMonthlyByVehicle.get(v.id) ?? 0) * months);
      const variable = round2(variableByVehicle.get(v.id) ?? 0);
      return {
        id: v.id,
        registrationNumber: v.registrationNumber,
        fixed,
        variable,
        total: round2(fixed + variable),
      };
    })
    .filter((t) => t.total > 0);

  return {
    range,
    months,
    fixedMonthly: round2(fixedMonthly),
    fixedTotal: round2(fixedTotal),
    variableTotal: round2(variableTotal),
    totalCost: round2(totalCost),
    totalKm: round2(totalKm),
    costPerKm: totalKm > 0 ? round2(totalCost / totalKm) : null,
    fixedByCategory: [...fixedCatMap.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    variableByCategory: [...varCatMap.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    tractors,
    trailers,
  };
}
