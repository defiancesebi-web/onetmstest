import Link from "next/link";
import { Gauge, Coins, Truck, Fuel, TrendingUp, Info } from "lucide-react";
import { auth } from "@/auth";
import { getCostAnalysis, COST_RANGES, type CostRange } from "@/lib/data/expenses";
import { fixedCostCategoryLabel, expenseCategoryLabel } from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { StatCard } from "@/components/dashboard/stat-card";
import { buttonVariants } from "@/components/ui/button";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.expenses;

  const range: CostRange = COST_RANGES.includes(rangeParam as CostRange)
    ? (rangeParam as CostRange)
    : "month";
  const data = await getCostAnalysis(sessionUser, companyId, range);

  const money = (n: number) =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 0,
    }).format(n);
  const money2 = (n: number) =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 2,
    }).format(n);
  const km = (n: number) =>
    `${new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US").format(n)} ${t.kmUnit}`;
  const cpk = (n: number | null) => (n === null ? "—" : `${money2(n)}${t.perKm}`);

  const rangeLabels: Record<CostRange, string> = {
    month: t.rangeMonth,
    year: t.rangeYear,
    rolling12: t.rangeRolling12,
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t.title}</h2>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/cheltuieli/fixe" className={buttonVariants({ variant: "outline" })}>
            {t.manageFixed}
          </Link>
          <Link href="/dashboard/cheltuieli/variabile" className={buttonVariants()}>
            {t.addExpense}
          </Link>
        </div>
      </div>

      <div className="bg-muted/60 inline-flex rounded-lg p-0.5 text-sm">
        {COST_RANGES.map((r) => (
          <Link
            key={r}
            href={`/dashboard/cheltuieli?range=${r}`}
            className={`rounded-md px-3 py-1.5 font-medium ${
              r === range ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {rangeLabels[r]}
          </Link>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={<Gauge className="size-5" />}
          label={t.kpiCostPerKm}
          value={cpk(data.costPerKm)}
          tone="bg-emerald-100 text-emerald-700"
        />
        <StatCard icon={<Coins className="size-5" />} label={t.kpiTotal} value={money(data.totalCost)} />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label={t.kpiFixed}
          value={money(data.fixedTotal)}
          tone="bg-violet-100 text-violet-700"
        />
        <StatCard
          icon={<Fuel className="size-5" />}
          label={t.kpiVariable}
          value={money(data.variableTotal)}
          tone="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={<Truck className="size-5" />}
          label={t.kpiKm}
          value={km(data.totalKm)}
          tone="bg-blue-100 text-blue-700"
        />
      </div>

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {t.basisNote}
      </p>

      {/* Per-tractor cost/km */}
      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <div className="border-b px-5 py-4">
          <h3 className="font-semibold">{t.perTractorHeading}</h3>
        </div>
        {data.tractors.length === 0 ? (
          <p className="text-muted-foreground p-5 text-sm">{t.noTractors}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-5 py-2.5 font-medium">{t.colTruck}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colKm}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colFixed}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colVariable}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colTotal}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colCostPerKm}</th>
                </tr>
              </thead>
              <tbody>
                {data.tractors.map((tr) => (
                  <tr key={tr.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5 font-medium">{tr.registrationNumber}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{km(tr.km)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(tr.fixed)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(tr.variable)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(tr.total)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                      {cpk(tr.costPerKm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trailers + category breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b px-5 py-4">
            <h3 className="font-semibold">{t.trailersHeading}</h3>
          </div>
          {data.trailers.length === 0 ? (
            <p className="text-muted-foreground p-5 text-sm">{t.noTrailers}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-5 py-2.5 font-medium">{t.colTrailer}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colFixed}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colVariable}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t.colTotal}</th>
                </tr>
              </thead>
              <tbody>
                {data.trailers.map((tr) => (
                  <tr key={tr.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5 font-medium">{tr.registrationNumber}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(tr.fixed)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(tr.variable)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(tr.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">{t.breakdownHeading}</h3>
          {data.fixedByCategory.length === 0 && data.variableByCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.noData}</p>
          ) : (
            <div className="space-y-4 text-sm">
              {data.fixedByCategory.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                    {t.fixedLabel}
                  </p>
                  <ul className="space-y-1">
                    {data.fixedByCategory.map((c) => (
                      <li key={c.category} className="flex justify-between">
                        <span>{fixedCostCategoryLabel(c.category, locale)}</span>
                        <span className="tabular-nums">{money(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.variableByCategory.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                    {t.variableLabel}
                  </p>
                  <ul className="space-y-1">
                    {data.variableByCategory.map((c) => (
                      <li key={c.category} className="flex justify-between">
                        <span>{expenseCategoryLabel(c.category, locale)}</span>
                        <span className="tabular-nums">{money(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
