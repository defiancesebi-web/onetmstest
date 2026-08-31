import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { getOrderById } from "@/lib/data/orders";
import { getCompanyForSession } from "@/lib/data/companies";
import { DEFAULT_VAT_RATE } from "@/lib/data/invoices";
import { todayKeyInBucharest, toDateKey } from "@/lib/documentStatus";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { InvoiceForm, type ClientOption, type InvoicePrefill } from "./invoice-form";

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

export default async function InvoiceNewPage({
  searchParams,
}: {
  searchParams: Promise<{ comanda?: string; comenzi?: string }>;
}) {
  const { comanda, comenzi } = await searchParams;
  const requestedOrderIds = (comenzi ?? comanda ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.invoiceForm;

  const [clientsRaw, company] = await Promise.all([
    listClients(sessionUser, companyId),
    getCompanyForSession(sessionUser),
  ]);

  const clients: ClientOption[] = clientsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    cui: c.cui,
    address: c.address,
    city: c.city,
    country: c.country,
    paymentTermDays: c.paymentTermDays,
  }));

  const vatPayer = company?.vatPayer ?? true;
  const today = todayKeyInBucharest();
  const defaultVat = vatPayer ? DEFAULT_VAT_RATE : "0";

  let prefill: InvoicePrefill | null = null;
  if (requestedOrderIds.length > 0) {
    const fetched = await Promise.all(requestedOrderIds.map((id) => getOrderById(sessionUser, id)));
    const orders = fetched.filter((o): o is NonNullable<typeof o> => o !== null);
    // One invoice = one buyer and one currency: keep only the orders that match
    // the first order's client and currency (the list button pre-checks this).
    const base = orders[0] ?? null;
    const usable = base
      ? orders.filter((o) => o.clientId === base.clientId && o.currency === base.currency)
      : [];
    if (base && usable.length > 0) {
      const client = clients.find((c) => c.id === base.clientId) ?? null;
      prefill = {
        orderIds: usable.map((o) => o.id),
        orderNumbers: usable.map((o) => o.orderNumber),
        clientId: base.clientId,
        currency: base.currency,
        exchangeRate: base.currency === "RON" ? "" : base.exchangeRate.toString(),
        dueDate: client ? addDays(today, client.paymentTermDays) : addDays(today, 30),
        lines: usable.map((o) => {
          const loading = o.stops.find((s) => s.type === "LOADING");
          const unloading = [...o.stops].reverse().find((s) => s.type === "UNLOADING");
          const route = loading && unloading ? ` ${loading.city}–${unloading.city}` : "";
          return {
            description: `Servicii transport${route} (comanda ${o.orderNumber})`,
            unitPrice: o.salePrice.toString(),
          };
        }),
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/facturare" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        {t.back}
      </Link>
      <PageHeader
        title={t.title}
        description={prefill ? `${t.fromOrder} ${prefill.orderNumbers.join(", ")}` : undefined}
      />

      <InvoiceForm
        t={t}
        locale={locale}
        clients={clients}
        vatPayer={vatPayer}
        defaultVat={defaultVat}
        today={today}
        defaultDue={addDays(today, 30)}
        prefill={prefill}
      />
    </div>
  );
}
