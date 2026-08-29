import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/documentStatus";
import { geocodeCity, type LatLng } from "@/lib/geo/cities";

/**
 * Per-order lane data for the dashboard Lane Visualizer. Each entry is one
 * order reduced to its origin → destination cities (geocoded), the revenue and
 * estimated profit it carried, and its pickup date. The client aggregates these
 * into lanes and filters by range, so no server round-trip on tab/range change.
 * Orders whose endpoints can't be geocoded (or that are cancelled) are dropped.
 */

export type LaneOrder = {
  originCity: string;
  destCity: string;
  from: LatLng;
  to: LatLng;
  revenue: number;
  profit: number;
  dateKey: string;
};

export async function getLaneOrders(session: SessionUser, companyId: string): Promise<LaneOrder[]> {
  assertCompanyAccess(session, companyId);

  const orders = await prisma.order.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    select: {
      salePriceRon: true,
      estimatedCostRon: true,
      stops: {
        select: { type: true, city: true, sequence: true, scheduledDate: true },
        orderBy: { sequence: "asc" },
      },
    },
  });

  const out: LaneOrder[] = [];
  for (const o of orders) {
    const loading = o.stops.find((s) => s.type === "LOADING") ?? o.stops[0] ?? null;
    const unloading =
      [...o.stops].reverse().find((s) => s.type === "UNLOADING") ?? o.stops[o.stops.length - 1] ?? null;
    if (!loading || !unloading) continue;

    const from = geocodeCity(loading.city);
    const to = geocodeCity(unloading.city);
    if (!from || !to) continue;

    const revenue = Number(o.salePriceRon);
    const profit = revenue - Number(o.estimatedCostRon ?? 0);

    out.push({
      originCity: loading.city,
      destCity: unloading.city,
      from,
      to,
      revenue,
      profit,
      dateKey: toDateKey(loading.scheduledDate),
    });
  }
  return out;
}
