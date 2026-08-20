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
  searchParams: Promise<{ comanda?: string }>;
}) {
  const { comanda } = await searchParams;
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
  const order = comanda ? await getOrderById(sessionUser, comanda) : null;
  if (order) {
    const loading = order.stops.find((s) => s.type === "LOADING");
    const unloading = [...order.stops].reverse().find((s) => s.type === "UNLOADING");
    const route =
      loading && unloading ? ` ${loading.city}–${unloading.city}` : "";
    const client = clients.find((c) => c.id === order.clientId) ?? null;
    prefill = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientId: order.clientId,
      currency: order.currency,
      exchangeRate: order.currency === "RON" ? "" : order.exchangeRate.toString(),
      dueDate: client ? addDays(today, client.paymentTermDays) : addDays(today, 30),
      line: {
        description: `Servicii transport${route} (comanda ${order.orderNumber})`,
        unitPrice: order.salePrice.toString(),
      },
    };
  }

  return (
    <div>
      <Link href="/dashboard/facturare" className="text-muted-foreground mb-4 inline-block text-sm underline">
        {t.back}
      </Link>
      <PageHeader
        title={t.title}
        description={prefill ? `${t.fromOrder} ${prefill.orderNumber}` : undefined}
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
