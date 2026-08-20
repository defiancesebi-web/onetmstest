import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { todayKeyInBucharest } from "@/lib/documentStatus";
import type { OrderStatus, InvoiceStatus } from "@/lib/generated/prisma/enums";

export type ReportRange = "month" | "year" | "all";
export const REPORT_RANGES: ReportRange[] = ["month", "year", "all"];

export type MonthlyPoint = { key: string; label: string; revenue: number };
export type TopClient = { name: string; revenue: string };
export type OverdueInvoice = {
  id: string;
  invoiceNumber: string | null;
  buyerName: string;
  dueKey: string;
  grossTotal: string;
  currency: string;
  daysOverdue: number;
};

export type ReportsData = {
  range: ReportRange;
  revenueNet: string;
  collectedNet: string;
  outstandingGross: string;
  overdueGross: string;
  invoiceCount: number;
  orderCount: number;
  tripsCompleted: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
  monthly: MonthlyPoint[];
  topClients: TopClient[];
  overdue: OverdueInvoice[];
};

/** Current calendar year/month in Europe/Bucharest, regardless of server TZ. */
function bucharestYearMonth(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  return { year, month };
}

function rangeStart(range: ReportRange): Date | null {
  const { year, month } = bucharestYearMonth();
  if (range === "month") return new Date(Date.UTC(year, month - 1, 1));
  if (range === "year") return new Date(Date.UTC(year, 0, 1));
  return null;
}

function decToString(value: { toString(): string } | null): string {
  return value ? value.toString() : "0";
}

export async function getReports(
  session: SessionUser,
  companyId: string,
  range: ReportRange
): Promise<ReportsData> {
  assertCompanyAccess(session, companyId);

  const start = rangeStart(range);
  const todayKey = todayKeyInBucharest();
  const today = new Date(`${todayKey}T00:00:00Z`);
  const issuedOrPaidStatuses: InvoiceStatus[] = ["ISSUED", "PAID"];
  const issuedOrPaid = { in: issuedOrPaidStatuses };
  const inRange = start ? { gte: start } : undefined;

  // Six-month revenue window is its own fixed span, independent of `range`.
  const { year, month } = bucharestYearMonth();
  const sixMonthsStart = new Date(Date.UTC(year, month - 6, 1));

  const [
    revenueAgg,
    collectedAgg,
    outstandingAgg,
    overdueAgg,
    orderCount,
    tripsCompleted,
    ordersGrouped,
    topClientsGrouped,
    monthlyInvoices,
    overdueRows,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId, status: issuedOrPaid, ...(inRange ? { issueDate: inRange } : {}) },
      _sum: { netTotal: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { companyId, status: "PAID", ...(inRange ? { issueDate: inRange } : {}) },
      _sum: { netTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, status: "ISSUED" },
      _sum: { grossTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, status: "ISSUED", dueDate: { lt: today } },
      _sum: { grossTotal: true },
    }),
    prisma.order.count({ where: { companyId, ...(start ? { createdAt: { gte: start } } : {}) } }),
    prisma.trip.count({
      where: { companyId, status: "COMPLETED", ...(start ? { startsAt: { gte: start } } : {}) },
    }),
    prisma.order.groupBy({ by: ["status"], where: { companyId }, _count: true }),
    prisma.invoice.groupBy({
      by: ["buyerName"],
      where: { companyId, status: issuedOrPaid, ...(inRange ? { issueDate: inRange } : {}) },
      _sum: { netTotal: true },
      orderBy: { _sum: { netTotal: "desc" } },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { companyId, status: issuedOrPaid, issueDate: { gte: sixMonthsStart } },
      select: { issueDate: true, netTotal: true },
    }),
    prisma.invoice.findMany({
      where: { companyId, status: "ISSUED", dueDate: { lt: today } },
      select: {
        id: true,
        invoiceNumber: true,
        buyerName: true,
        dueDate: true,
        grossTotal: true,
        currency: true,
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  // Bucket the last six months (including the current one) by YYYY-MM.
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const monthTotals = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  for (const inv of monthlyInvoices) {
    const d = inv.issueDate;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (monthTotals.has(key)) monthTotals.set(key, monthTotals.get(key)! + Number(inv.netTotal));
  }
  const monthly: MonthlyPoint[] = monthKeys.map((key) => ({
    key,
    label: key.slice(5), // "MM"
    revenue: Math.round((monthTotals.get(key) ?? 0) * 100) / 100,
  }));

  const msPerDay = 24 * 60 * 60 * 1000;
  const overdue: OverdueInvoice[] = overdueRows.map((row) => {
    const dueKey = row.dueDate.toISOString().slice(0, 10);
    const daysOverdue = Math.max(0, Math.round((today.getTime() - row.dueDate.getTime()) / msPerDay));
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      buyerName: row.buyerName,
      dueKey,
      grossTotal: decToString(row.grossTotal),
      currency: row.currency,
      daysOverdue,
    };
  });

  return {
    range,
    revenueNet: decToString(revenueAgg._sum?.netTotal ?? null),
    collectedNet: decToString(collectedAgg._sum?.netTotal ?? null),
    outstandingGross: decToString(outstandingAgg._sum?.grossTotal ?? null),
    overdueGross: decToString(overdueAgg._sum?.grossTotal ?? null),
    invoiceCount: revenueAgg._count,
    orderCount,
    tripsCompleted,
    ordersByStatus: ordersGrouped.map((g) => ({ status: g.status, count: g._count })),
    monthly,
    topClients: topClientsGrouped.map((g) => ({
      name: g.buyerName,
      revenue: decToString(g._sum.netTotal),
    })),
    overdue,
  };
}
