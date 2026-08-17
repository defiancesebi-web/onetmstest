import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getClientById } from "@/lib/data/clients";
import { listOrders } from "@/lib/data/orders";
import { ORDER_STATUS_LABELS } from "@/lib/orderStatus";
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
      <Link href="/dashboard/clienti" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la clienți
      </Link>

      <PageHeader
        title={client.name}
        description={
          <>
            CUI: {client.cui} · <Badge>{client.isActive ? "Activ" : "Inactiv"}</Badge>
          </>
        }
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={client.isActive ? "destructive" : "outline"}>
              {client.isActive ? "Dezactivează" : "Reactivează"}
            </Button>
          </form>
        }
      />

      <ClientForm action={boundUpdate} values={client} submitLabel="Salvează modificările" />

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium">Comenzile acestui client</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nicio comandă încă.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-4 py-2 font-medium">Număr</th>
                  <th className="px-4 py-2 font-medium">Referință</th>
                  <th className="px-4 py-2 font-medium">Preț</th>
                  <th className="px-4 py-2 font-medium">Stare</th>
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
                      <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
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
