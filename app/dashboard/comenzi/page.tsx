import Link from "next/link";
import { auth } from "@/auth";
import { listOrders } from "@/lib/data/orders";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { ORDER_STATUS_I18N, orderStatusLabel } from "@/lib/labels";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { OrderStatusPill } from "@/components/dashboard/order-status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_VALUES = Object.keys(ORDER_STATUS_I18N.ro) as OrderStatus[];

export default async function ComenziPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stare?: string }>;
}) {
  const { q, stare } = await searchParams;
  const session = await auth();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.loads;

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
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/comenzi/noua" className={buttonVariants()}>
            {d.newLabel}
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          name="q"
          placeholder={d.searchPlaceholder}
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <select
          name="stare"
          defaultValue={stare ?? ""}
          className="rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">{d.allStatuses}</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {orderStatusLabel(value, locale)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          {d.filter}
        </Button>
      </form>

      {orders.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {d.notFound}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{d.colNumber}</th>
                <th className="px-4 py-2 font-medium">{d.colClient}</th>
                <th className="px-4 py-2 font-medium">{d.colRef}</th>
                <th className="px-4 py-2 font-medium">{d.colPrice}</th>
                <th className="px-4 py-2 font-medium">{d.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/comenzi/${order.id}`} className="text-primary font-medium">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{order.client.name}</td>
                  <td className="text-muted-foreground px-4 py-2">{order.clientReference}</td>
                  <td className="px-4 py-2">
                    {order.salePrice.toString()} {order.currency}
                  </td>
                  <td className="px-4 py-2">
                    <OrderStatusPill status={order.status} locale={locale} />
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
