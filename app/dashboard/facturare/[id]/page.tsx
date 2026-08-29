import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getInvoiceById } from "@/lib/data/invoices";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceActions } from "./invoice-actions";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.invoiceView;

  const invoice = await getInvoiceById(sessionUser, id);
  if (!invoice) notFound();

  const money = (value: string) =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: invoice.currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  const dateFmt = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const title = invoice.invoiceNumber ? `${t.invoiceWord} ${invoice.invoiceNumber}` : t.draftTitle;

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/facturare"
        className="text-muted-foreground mb-4 inline-block text-sm underline print:hidden"
      >
        {t.back}
      </Link>

      <PageHeader
        title={title}
        description={<InvoiceStatusBadge status={invoice.status} locale={locale} />}
        actions={<InvoiceActions invoiceId={invoice.id} status={invoice.status} t={t} />}
      />

      <div className="bg-card rounded-xl border p-6 shadow-sm print:border-0 print:shadow-none">
        {/* Parties */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">{t.supplier}</p>
            <p className="font-semibold">{invoice.sellerName}</p>
            <p className="text-muted-foreground text-sm">
              {t.cui}: {invoice.sellerCui}
              {invoice.sellerRegCom ? ` · ${t.regCom}: ${invoice.sellerRegCom}` : ""}
            </p>
            <p className="text-muted-foreground text-sm">
              {[invoice.sellerAddress, invoice.sellerCity, invoice.sellerCounty, invoice.sellerCountry]
                .filter(Boolean)
                .join(", ")}
            </p>
            {invoice.sellerIban && (
              <p className="text-muted-foreground text-sm">
                {t.iban}: {invoice.sellerIban}
                {invoice.sellerBank ? ` · ${t.bank}: ${invoice.sellerBank}` : ""}
              </p>
            )}
            {(invoice.sellerPhone || invoice.sellerEmail) && (
              <p className="text-muted-foreground text-sm">
                {[
                  invoice.sellerPhone ? `${t.phone}: ${invoice.sellerPhone}` : null,
                  invoice.sellerEmail ? `${t.email}: ${invoice.sellerEmail}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {invoice.sellerCapital && (
              <p className="text-muted-foreground text-sm">
                {t.capital}: {invoice.sellerCapital}
              </p>
            )}
            {!invoice.sellerVatPayer && (
              <p className="mt-1 text-xs font-medium text-amber-700">{t.nonVatMention}</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">{t.buyer}</p>
            <p className="font-semibold">{invoice.buyerName}</p>
            <p className="text-muted-foreground text-sm">
              {t.cui}: {invoice.buyerCui}
              {invoice.buyerRegCom ? ` · ${t.regCom}: ${invoice.buyerRegCom}` : ""}
            </p>
            <p className="text-muted-foreground text-sm">
              {[invoice.buyerAddress, invoice.buyerCity, invoice.buyerCounty, invoice.buyerCountry]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-y py-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t.issueDate}: </span>
            {dateFmt.format(invoice.issueDate)}
          </div>
          <div>
            <span className="text-muted-foreground">{t.dueDate}: </span>
            {dateFmt.format(invoice.dueDate)}
          </div>
          {invoice.currency !== "RON" && invoice.exchangeRate && (
            <div>
              <span className="text-muted-foreground">{t.exchangeInfo}: </span>
              1 {invoice.currency} = {invoice.exchangeRate.toString()} RON
            </div>
          )}
          {invoice.orders.length > 0 && (
            <div className="print:hidden">
              <span className="text-muted-foreground">{t.fromOrder}: </span>
              {invoice.orders.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ", "}
                  <Link href={`/dashboard/comenzi/${o.id}`} className="text-primary">
                    {o.orderNumber}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-2 font-medium">{t.colNr}</th>
                <th className="py-2 pr-2 font-medium">{t.colDescription}</th>
                <th className="py-2 pr-2 font-medium">{t.colUnit}</th>
                <th className="py-2 pr-2 text-right font-medium">{t.colQty}</th>
                <th className="py-2 pr-2 text-right font-medium">{t.colUnitPrice}</th>
                {invoice.sellerVatPayer && (
                  <th className="py-2 pr-2 text-right font-medium">{t.colVat}</th>
                )}
                <th className="py-2 text-right font-medium">{t.colNet}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">{line.sequence}</td>
                  <td className="py-2 pr-2">{line.description}</td>
                  <td className="text-muted-foreground py-2 pr-2">{line.unit}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{line.quantity.toString()}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {money(line.unitPrice.toString())}
                  </td>
                  {invoice.sellerVatPayer && (
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {line.vatRate.toString()}%
                    </td>
                  )}
                  <td className="py-2 text-right tabular-nums">{money(line.netAmount.toString())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t.totalNet}</dt>
              <dd className="tabular-nums">{money(invoice.netTotal.toString())}</dd>
            </div>
            {invoice.sellerVatPayer && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.totalVat}</dt>
                <dd className="tabular-nums">{money(invoice.vatTotal.toString())}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 text-base font-bold">
              <dt>{t.totalGross}</dt>
              <dd className="tabular-nums">{money(invoice.grossTotal.toString())}</dd>
            </div>
          </dl>
        </div>

        {invoice.notes && (
          <div className="mt-6 border-t pt-3 text-sm">
            <span className="text-muted-foreground">{t.notes}: </span>
            {invoice.notes}
          </div>
        )}
      </div>
    </div>
  );
}
