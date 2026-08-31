import Link from "next/link";
import { auth } from "@/auth";
import { listFixedCosts, amountToRon } from "@/lib/data/expenses";
import { listVehicles } from "@/lib/data/vehicles";
import {
  FIXED_COST_CATEGORY_I18N,
  FIXED_COST_PERIOD_I18N,
  fixedCostCategoryLabel,
  fixedCostPeriodLabel,
  vehicleTypeLabel,
} from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import type { FixedCostCategory, FixedCostPeriod } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { ActivePill } from "@/components/active-pill";
import { FixedCostForm } from "./fixed-cost-form";
import { FixedCostRowActions } from "./row-actions";

export default async function FixedCostsPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.expenses;

  const [fixedCosts, vehicles] = await Promise.all([
    listFixedCosts(sessionUser, companyId),
    listVehicles(sessionUser, companyId),
  ]);

  const money = (n: number) =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 2,
    }).format(n);
  const monthlyEquiv = (fc: (typeof fixedCosts)[number]) =>
    amountToRon(fc.amount, fc.currency, fc.exchangeRate) / (fc.period === "YEARLY" ? 12 : 1);

  const categories = (Object.keys(FIXED_COST_CATEGORY_I18N.ro) as FixedCostCategory[]).map((v) => ({
    value: v,
    label: fixedCostCategoryLabel(v, locale),
  }));
  const periods = (Object.keys(FIXED_COST_PERIOD_I18N.ro) as FixedCostPeriod[]).map((v) => ({
    value: v,
    label: fixedCostPeriodLabel(v, locale),
  }));
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id,
    label: `${v.registrationNumber} · ${vehicleTypeLabel(v.type, locale)}`,
  }));

  return (
    <div className="space-y-4">
      <Link href="/dashboard/cheltuieli" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        {t.back}
      </Link>
      <PageHeader title={t.fixedTitle} />

      <div className="bg-card mb-8 rounded-xl border p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium">{t.fixedNewHeading}</h2>
        <FixedCostForm t={t} categories={categories} periods={periods} vehicles={vehicleOptions} />
      </div>

      {fixedCosts.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t.noFixed}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{t.colLabel}</th>
                <th className="px-4 py-2 font-medium">{t.colCategory}</th>
                <th className="px-4 py-2 font-medium">{t.colPeriod}</th>
                <th className="px-4 py-2 text-right font-medium">{t.colAmountMonthly}</th>
                <th className="px-4 py-2 font-medium">{t.colVehicle}</th>
                <th className="px-4 py-2 font-medium">{t.colActive}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {fixedCosts.map((fc) => (
                <tr key={fc.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{fc.label}</td>
                  <td className="px-4 py-2">{fixedCostCategoryLabel(fc.category, locale)}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {fixedCostPeriodLabel(fc.period, locale)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {money(monthlyEquiv(fc))}
                    {t.perMonth}
                    {fc.currency !== "RON" && (
                      <span className="text-muted-foreground block text-xs">
                        {fc.amount.toString()} {fc.currency}
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {fc.vehicle?.registrationNumber ?? t.generalOption}
                  </td>
                  <td className="px-4 py-2">
                    <ActivePill active={fc.isActive} activeLabel={t.active} inactiveLabel={t.inactive} />
                  </td>
                  <td className="px-4 py-2">
                    <FixedCostRowActions
                      id={fc.id}
                      isActive={fc.isActive}
                      labels={{
                        activate: t.activate,
                        deactivate: t.deactivate,
                        delete: t.delete,
                        confirmDelete: t.confirmDelete,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
