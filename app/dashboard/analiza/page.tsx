import Link from "next/link";
import { Banknote, Coins, Percent, Gauge, Fuel, Route } from "lucide-react";
import { auth } from "@/auth";
import { getCostAnalysis } from "@/lib/data/expenses";
import { getReports } from "@/lib/data/reports";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { fixedCostCategoryLabel, expenseCategoryLabel } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { BarChart } from "@/components/dashboard/bar-chart";

type Period = "month" | "year" | "rolling12";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const period: Period = p === "year" || p === "rolling12" ? p : "month";
  const reportRange = period === "rolling12" ? "all" : period;

  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.analytics;

  const [cost, reports] = await Promise.all([
    getCostAnalysis(sessionUser, companyId, period),
    getReports(sessionUser, companyId, reportRange),
  ]);

  const intl = locale === "ro" ? "ro-RO" : "en-US";
  const money0 = new Intl.NumberFormat(intl, { style: "currency", currency: "RON", maximumFractionDigits: 0 });
  const num2 = new Intl.NumberFormat(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num1 = new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const revenue = Number(reports.revenueNet);
  const profit = revenue - cost.totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;

  const periods: { key: Period; label: string }[] = [
    { key: "month", label: t.periodMonth },
    { key: "year", label: t.periodYear },
    { key: "rolling12", label: t.periodRolling },
  ];

  const tractors = [...cost.tractors].sort((a, b) => (b.costPerKm ?? -1) - (a.costPerKm ?? -1));
  const monthly = reports.monthly.map((m) => ({ label: m.label, value: m.revenue }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={t.title} description={t.description} />
        <div className="bg-card flex items-center gap-0.5 rounded-lg border p-0.5 text-[13px]">
          {periods.map((per) => (
            <Link
              key={per.key}
              href={`/dashboard/analiza?p=${per.key}`}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                period === per.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {per.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<Banknote className="size-5" />} label={t.kpiRevenue} value={money0.format(revenue)} tone="bg-emerald-100 text-emerald-700" />
        <StatCard icon={<Coins className="size-5" />} label={t.kpiCost} value={money0.format(cost.totalCost)} tone="bg-rose-100 text-rose-700" />
        <StatCard icon={<Banknote className="size-5" />} label={t.kpiProfit} value={money0.format(profit)} tone={profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} />
        <StatCard icon={<Percent className="size-5" />} label={t.kpiMargin} value={margin !== null ? `${num1.format(margin)}%` : "—"} tone="bg-violet-100 text-violet-700" />
        <StatCard icon={<Gauge className="size-5" />} label={t.kpiCostPerKm} value={cost.costPerKm !== null ? `${num2.format(cost.costPerKm)} lei` : "—"} tone="bg-blue-100 text-blue-700" />
        <StatCard icon={<Fuel className="size-5" />} label={t.kpiConsumption} value={cost.consumptionPer100Km !== null ? `${num1.format(cost.consumptionPer100Km)} l/100km` : "—"} tone="bg-amber-100 text-amber-700" />
      </div>

      {/* Per-tractor cost */}
      <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold">{t.perTractorHeading}</h3>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Route className="size-3.5" />
            {num2.format(cost.totalKm)} km
          </span>
        </div>
        {tractors.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">{t.noTractors}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-[11px] font-bold tracking-[0.04em] uppercase">
                  <th className="px-5 py-2.5">{t.colTruck}</th>
                  <th className="px-5 py-2.5 text-right">{t.colKm}</th>
                  <th className="px-5 py-2.5 text-right">{t.colCostPerKm}</th>
                  <th className="px-5 py-2.5 text-right">{t.colFullCostPerKm}</th>
                  <th className="px-5 py-2.5 text-right">{t.colConsumption}</th>
                  <th className="px-5 py-2.5 text-right">{t.colTotal}</th>
                </tr>
              </thead>
              <tbody>
                {tractors.map((tr) => (
                  <tr key={tr.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5 font-medium">{tr.registrationNumber}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{num2.format(tr.km)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                      {tr.costPerKm !== null ? `${num2.format(tr.costPerKm)}` : "—"}
                    </td>
                    <td className="text-muted-foreground px-5 py-2.5 text-right tabular-nums">
                      {tr.fullyLoadedCostPerKm !== null ? `${num2.format(tr.fullyLoadedCostPerKm)}` : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">
                      {tr.consumptionPer100Km !== null ? `${num1.format(tr.consumptionPer100Km)}` : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money0.format(tr.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue trend */}
        <section className="bg-card rounded-xl border p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 font-semibold">{t.revenueTrendHeading}</h3>
          {monthly.every((m) => m.value === 0) ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t.noData}</p>
          ) : (
            <div className="h-52">
              <BarChart points={monthly} format={(n) => money0.format(n)} />
            </div>
          )}
        </section>

        {/* Cost breakdown */}
        <section className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">{t.breakdownHeading}</h3>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.fixedLabel}</span>
            <span className="font-semibold tabular-nums">{money0.format(cost.fixedTotal)}</span>
          </div>
          <ul className="mb-3 space-y-1">
            {cost.fixedByCategory.map((c) => (
              <li key={c.category} className="text-muted-foreground flex justify-between text-xs">
                <span>{fixedCostCategoryLabel(c.category, locale)}</span>
                <span className="tabular-nums">{money0.format(c.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mb-2 flex items-center justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">{t.variableLabel}</span>
            <span className="font-semibold tabular-nums">{money0.format(cost.variableTotal)}</span>
          </div>
          <ul className="space-y-1">
            {cost.variableByCategory.map((c) => (
              <li key={c.category} className="text-muted-foreground flex justify-between text-xs">
                <span>{expenseCategoryLabel(c.category, locale)}</span>
                <span className="tabular-nums">{money0.format(c.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Top clients */}
      <section className="bg-card rounded-xl border p-5 shadow-sm">
        <h3 className="mb-3 font-semibold">{t.topClientsHeading}</h3>
        {reports.topClients.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.noData}</p>
        ) : (
          <ul className="space-y-2">
            {reports.topClients.map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="font-semibold tabular-nums">{money0.format(Number(c.revenue))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
