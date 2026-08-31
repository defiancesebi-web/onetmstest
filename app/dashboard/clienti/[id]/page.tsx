import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getClientById } from "@/lib/data/clients";
import { listOrders } from "@/lib/data/orders";
import { orderStatusLabel } from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientForm } from "../client-form";
import { updateClientAction, setClientActiveAction } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.customerForm;

  const client = await getClientById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!client) notFound();

  const orders = await listOrders(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { clientId: client.id }
  );

  const boundUpdate = updateClientAction.bind(null, client.id);
  const boundToggle = setClientActiveAction.bind(null, client.id, !client.isActive);

  return (
    <div>
      <Link href="/dashboard/clienti" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        {t.back}
      </Link>

      <PageHeader
        title={client.name}
        description={
          <>
            {t.cui}: {client.cui} ·{" "}
            <Badge>{client.isActive ? t.activeBadge : t.inactiveBadge}</Badge>
          </>
        }
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={client.isActive ? "destructive" : "outline"}>
              {client.isActive ? t.deactivate : t.reactivate}
            </Button>
          </form>
        }
      />

      <ClientForm action={boundUpdate} values={client} submitLabel={t.saveChanges} t={t} />

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium">{t.ordersHeading}</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.noOrders}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-4 py-2 font-medium">{t.colNumber}</th>
                  <th className="px-4 py-2 font-medium">{t.colRef}</th>
                  <th className="px-4 py-2 font-medium">{t.colPrice}</th>
                  <th className="px-4 py-2 font-medium">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/dashboard/comenzi/${order.id}`} className="underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-2">{order.clientReference}</td>
                    <td className="px-4 py-2">
                      {order.salePrice.toString()} {order.currency}
                    </td>
                    <td className="px-4 py-2">
                      <Badge>{orderStatusLabel(order.status, locale)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
