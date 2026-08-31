import Link from "next/link";
import { Banknote, Wallet, HandCoins, TriangleAlert, Package, Route } from "lucide-react";
import { auth } from "@/auth";
import { getReports, REPORT_RANGES, type ReportRange } from "@/lib/data/reports";
import { orderStatusLabel } from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { BarChart } from "@/components/dashboard/bar-chart";
import { STATUS_HEX } from "@/components/dashboard/order-status-pill";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.reports;

  const range: ReportRange = REPORT_RANGES.includes(rangeParam as ReportRange)
    ? (rangeParam as ReportRange)
    : "year";

  const data = await getReports(sessionUser, companyId, range);

  const money = (value: string | number, currency = "RON") =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value));
  const dateFmt = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const rangeLabels: Record<ReportRange, string> = {
    month: t.rangeMonth,
    year: t.rangeYear,
    all: t.rangeAll,
  };

  const totalOrders = data.ordersByStatus.reduce((s, x) => s + x.count, 0);
  const donutSegments = data.ordersByStatus
    .filter((s) => s.count > 0)
    .map((s) => ({ label: orderStatusLabel(s.status, locale), value: s.count, color: STATUS_HEX[s.status] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t.title}</h2>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="bg-muted/60 inline-flex rounded-lg p-0.5 text-sm">
          {REPORT_RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard/rapoarte?range=${r}`}
              className={`rounded-md px-3 py-1.5 font-medium ${
                r === range ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {rangeLabels[r]}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={<Banknote className="size-5" />}
          label={t.kpiRevenue}
          value={money(data.revenueNet)}
          sub={t.kpiRevenueHint}
          tone="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={<Wallet className="size-5" />}
          label={t.kpiCollected}
          value={money(data.collectedNet)}
          tone="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon={<HandCoins className="size-5" />}
          label={t.kpiOutstanding}
          value={money(data.outstandingGross)}
          sub={t.kpiOutstandingHint}
          tone="bg-violet-100 text-violet-700"
        />
        <StatCard
          icon={<TriangleAlert className="size-5" />}
          label={t.kpiOverdue}
          value={money(data.overdueGross)}
          tone="bg-rose-100 text-rose-700"
        />
        <StatCard
          icon={<Package className="size-5" />}
          label={t.kpiOrders}
          value={String(data.orderCount)}
        />
        <StatCard
          icon={<Route className="size-5" />}
          label={t.kpiTrips}
          value={String(data.tripsCompleted)}
          tone="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Monthly revenue + orders by status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-xl border p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{t.monthlyHeading}</h3>
            <span className="text-muted-foreground text-xs">{t.last6months}</span>
          </div>
          <div className="h-52">
            <BarChart
              points={data.monthly.map((m) => ({ label: m.label, value: m.revenue }))}
              format={(n) => money(n)}
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-2 font-semibold">{t.byStatusHeading}</h3>
          {donutSegments.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t.noData}</p>
          ) : (
            <>
              <div className="flex items-center justify-center py-1">
                <DonutChart segments={donutSegments} centerValue={String(totalOrders)} centerLabel={t.total} />
              </div>
              <ul className="mt-3 space-y-1.5">
                {donutSegments.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1">{s.label}</span>
                    <span className="text-muted-foreground tabular-nums">{s.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Top clients + overdue */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b px-5 py-4">
            <h3 className="font-semibold">{t.topClientsHeading}</h3>
          </div>
          {data.topClients.length === 0 ? (
            <p className="text-muted-foreground p-5 text-sm">{t.noData}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-5 py-2.5 font-medium">{t.colClient}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colRevenue}</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="px-5 py-2.5">{c.name}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b px-5 py-4">
            <h3 className="font-semibold">{t.overdueHeading}</h3>
          </div>
          {data.overdue.length === 0 ? (
            <p className="text-muted-foreground p-5 text-sm">{t.noOverdue}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-5 py-2.5 font-medium">{t.colInvoice}</th>
                  <th className="px-5 py-2.5 font-medium">{t.colDue}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                {data.overdue.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5">
                      <Link href={`/dashboard/facturare/${inv.id}`} className="text-primary font-medium">
                        {inv.invoiceNumber}
                      </Link>
                      <span className="text-muted-foreground block text-xs">{inv.buyerName}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      {dateFmt.format(new Date(`${inv.dueKey}T00:00:00Z`))}
                      <span className="block text-xs text-rose-600">
                        {inv.daysOverdue} {t.daysWord}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {money(inv.grossTotal, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
