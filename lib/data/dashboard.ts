import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export type RecentLoad = {
  id: string;
  orderNumber: string;
  clientName: string;
  status: OrderStatus;
  from: string | null;
  to: string | null;
};

export type DayPoint = { key: string; total: number; delivered: number };

export type DashboardStats = {
  total: number;
  inTransit: number;
  delivered: number;
  revenueRon: number;
  marginPct: number | null;
  byStatus: { status: OrderStatus; count: number }[];
  recent: RecentLoad[];
  series: DayPoint[];
};

const DELIVERED_OR_BEYOND: OrderStatus[] = ["DELIVERED", "DOCUMENTS_RECEIVED", "INVOICED"];

/** A calendar-day key (YYYY-MM-DD) in Europe/Bucharest for a live instant. */
function bucharestDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getDashboardStats(
  session: SessionUser,
  companyId: string
): Promise<DashboardStats> {
  assertCompanyAccess(session, companyId);

  // Seven-day window (today plus the six days before it).
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 6);
  windowStart.setHours(0, 0, 0, 0);

  const [grouped, revenueAgg, marginAgg, recent, windowRows] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { companyId }, _sum: { salePriceRon: true } }),
    prisma.order.aggregate({
      where: { companyId, estimatedCostRon: { not: null } },
      _sum: { salePriceRon: true, estimatedCostRon: true },
    }),
    prisma.order.findMany({
      where: { companyId },
      include: {
        client: { select: { name: true } },
        stops: { orderBy: { sequence: "asc" }, select: { city: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.order.findMany({
      where: { companyId, createdAt: { gte: windowStart } },
      select: { createdAt: true, status: true },
    }),
  ]);

  const countOf = (s: OrderStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const delivered = DELIVERED_OR_BEYOND.reduce((sum, s) => sum + countOf(s), 0);

  const marginSale = Number(marginAgg._sum.salePriceRon ?? 0);
  const marginCost = Number(marginAgg._sum.estimatedCostRon ?? 0);
  const marginPct = marginSale > 0 ? ((marginSale - marginCost) / marginSale) * 100 : null;

  // Build the seven day buckets in order, then fill from the window rows.
  const days: DayPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: bucharestDayKey(d), total: 0, delivered: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const row of windowRows) {
    const bucket = byKey.get(bucharestDayKey(row.createdAt));
    if (!bucket) continue;
    bucket.total += 1;
    if (DELIVERED_OR_BEYOND.includes(row.status)) bucket.delivered += 1;
  }

  return {
    total,
    inTransit: countOf("IN_PROGRESS"),
    delivered,
    revenueRon: Number(revenueAgg._sum.salePriceRon ?? 0),
    marginPct,
    byStatus: grouped.map((g) => ({ status: g.status, count: g._count._all })),
    recent: recent.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      clientName: o.client.name,
      status: o.status,
      from: o.stops[0]?.city ?? null,
      to: o.stops[o.stops.length - 1]?.city ?? null,
    })),
    series: days,
  };
}
