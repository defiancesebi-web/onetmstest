import Link from "next/link";
import { auth } from "@/auth";
import { listExpenses } from "@/lib/data/expenses";
import { listVehicles } from "@/lib/data/vehicles";
import { listDrivers } from "@/lib/data/drivers";
import {
  EXPENSE_CATEGORY_I18N,
  expenseCategoryLabel,
  vehicleTypeLabel,
} from "@/lib/labels";
import { todayKeyInBucharest } from "@/lib/documentStatus";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import type { ExpenseCategory } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "./expense-form";
import { ExpenseDeleteButton } from "./delete-button";

export default async function VariableExpensesPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.expenses;

  const [expenses, vehicles, drivers] = await Promise.all([
    listExpenses(sessionUser, companyId),
    listVehicles(sessionUser, companyId),
    listDrivers(sessionUser, companyId),
  ]);

  const money = (n: number) =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 2,
    }).format(n);
  const dateFmt = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const categories = (Object.keys(EXPENSE_CATEGORY_I18N.ro) as ExpenseCategory[]).map((v) => ({
    value: v,
    label: expenseCategoryLabel(v, locale),
  }));
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id,
    label: `${v.registrationNumber} · ${vehicleTypeLabel(v.type, locale)}`,
  }));
  const driverOptions = drivers.map((d) => ({
    value: d.id,
    label: `${d.lastName} ${d.firstName}`,
  }));

  return (
    <div className="space-y-4">
      <Link href="/dashboard/cheltuieli" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        {t.back}
      </Link>
      <PageHeader title={t.varTitle} />

      <div className="bg-card mb-8 rounded-xl border p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-medium">{t.varNewHeading}</h2>
        <ExpenseForm
          t={t}
          categories={categories}
          vehicles={vehicleOptions}
          drivers={driverOptions}
          today={todayKeyInBucharest()}
        />
      </div>

      {expenses.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t.noExpenses}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{t.colDate}</th>
                <th className="px-4 py-2 font-medium">{t.colCategory}</th>
                <th className="px-4 py-2 font-medium">{t.colVehicle}</th>
                <th className="px-4 py-2 text-right font-medium">{t.eAmount}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="text-muted-foreground px-4 py-2">{dateFmt.format(e.date)}</td>
                  <td className="px-4 py-2">{expenseCategoryLabel(e.category, locale)}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {e.vehicle?.registrationNumber ??
                      (e.driver ? `${e.driver.lastName} ${e.driver.firstName}` : "—")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {e.currency === "RON"
                      ? money(Number(e.amount))
                      : `${e.amount.toString()} ${e.currency}`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ExpenseDeleteButton
                      id={e.id}
                      labels={{ delete: t.delete, confirmDelete: t.confirmDelete }}
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
