import Link from "next/link";
import { auth } from "@/auth";
import { listOrders } from "@/lib/data/orders";
import { ORDER_STATUS_LABELS } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_VALUES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export default async function ComenziPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stare?: string }>;
}) {
  const { q, stare } = await searchParams;
  const session = await auth();

  const status = STATUS_VALUES.includes(stare as OrderStatus)
    ? (stare as OrderStatus)
    : undefined;

  const orders = await listOrders(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { search: q, status }
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Comenzi"
        description="Comenzile de transport primite de la clienți."
        actions={
          <Link href="/dashboard/comenzi/noua" className={buttonVariants()}>
            Comandă nouă
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          name="q"
          placeholder="Caută după număr sau referința clientului"
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <select
          name="stare"
          defaultValue={stare ?? ""}
          className="rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">Toate stările</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
      </form>

      {orders.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Nicio comandă găsită.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Număr</th>
                <th className="px-4 py-2 font-medium">Client</th>
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
                  <td className="px-4 py-2">{order.client.name}</td>
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
    </div>
  );
}
