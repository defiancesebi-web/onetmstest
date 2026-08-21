import Link from "next/link";
import { TriangleAlert, Settings } from "lucide-react";
import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { listInvoices } from "@/lib/data/invoices";
import { INVOICE_STATUS_I18N } from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import type { InvoiceStatus } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_VALUES: InvoiceStatus[] = ["DRAFT", "ISSUED", "PAID", "CANCELLED"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.invoices;

  const statusFilter = STATUS_VALUES.includes(status as InvoiceStatus)
    ? (status as InvoiceStatus)
    : undefined;

  const [company, invoices] = await Promise.all([
    getCompanyForSession(sessionUser),
    listInvoices(sessionUser, companyId, { search: q, status: statusFilter }),
  ]);

  const needsSetup = !company?.invoiceSeries;
  const money = (value: string, currency: string) =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  const dateFmt = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/setari" className={buttonVariants({ variant: "outline" })}>
              <Settings className="size-4" />
              {t.settingsLabel}
            </Link>
            <Link href="/dashboard/facturare/noua" className={buttonVariants()}>
              {t.newLabel}
            </Link>
          </div>
        }
      />

      {needsSetup && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="flex-1">{t.setupNeeded}</span>
          <Link
            href="/dashboard/setari"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.setupCta}
          </Link>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input name="q" placeholder={t.searchPlaceholder} defaultValue={q ?? ""} className="max-w-xs" />
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">{t.allStatuses}</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUS_I18N[locale][s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          {t.filter}
        </Button>
      </form>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t.notFound}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{t.colNumber}</th>
                <th className="px-4 py-2 font-medium">{t.colClient}</th>
                <th className="px-4 py-2 font-medium">{t.colIssue}</th>
                <th className="px-4 py-2 font-medium">{t.colDue}</th>
                <th className="px-4 py-2 text-right font-medium">{t.colTotal}</th>
                <th className="px-4 py-2 font-medium">{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/facturare/${inv.id}`} className="text-primary font-medium">
                      {inv.invoiceNumber ?? t.draftRow}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{inv.buyerName}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {dateFmt.format(inv.issueDate)}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{dateFmt.format(inv.dueDate)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {money(inv.grossTotal.toString(), inv.currency)}
                  </td>
                  <td className="px-4 py-2">
                    <InvoiceStatusBadge status={inv.status} locale={locale} />
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
