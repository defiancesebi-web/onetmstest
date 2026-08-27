import Link from "next/link";
import { auth } from "@/auth";
import { listOrders } from "@/lib/data/orders";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { ORDER_STATUS_I18N, orderStatusLabel } from "@/lib/labels";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { OrderStatusPill } from "@/components/dashboard/order-status-pill";
import { DataTable, Toolbar, FilterTabs, type Column } from "@/components/ui/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_VALUES = Object.keys(ORDER_STATUS_I18N.ro) as OrderStatus[];

type Order = Awaited<ReturnType<typeof listOrders>>[number];

export default async function ComenziPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stare?: string }>;
}) {
  const { q, stare } = await searchParams;
  const session = await auth();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.loads;

  const status = STATUS_VALUES.includes(stare as OrderStatus) ? (stare as OrderStatus) : undefined;

  const orders = await listOrders(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { search: q, status },
  );

  // Status filter pills (All + each status), preserving the current search.
  const qs = (v: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (v) p.set("stare", v);
    const s = p.toString();
    return `/dashboard/comenzi${s ? `?${s}` : ""}`;
  };
  const filterOptions = [
    { value: "", label: d.allStatuses },
    ...STATUS_VALUES.map((v) => ({ value: v, label: orderStatusLabel(v, locale) })),
  ];

  const columns: Column<Order>[] = [
    {
      key: "number",
      header: d.colNumber,
      cell: (o) => (
        <Link href={`/dashboard/comenzi/${o.id}`} className="text-primary font-semibold">
          {o.orderNumber}
        </Link>
      ),
    },
    { key: "client", header: d.colClient, cell: (o) => o.client.name },
    {
      key: "ref",
      header: d.colRef,
      cell: (o) => <span className="text-muted-foreground">{o.clientReference}</span>,
    },
    {
      key: "price",
      header: d.colPrice,
      align: "right",
      cell: (o) => (
        <span className="font-semibold">
          {o.salePrice.toString()} {o.currency}
        </span>
      ),
    },
    {
      key: "status",
      header: d.colStatus,
      cell: (o) => <OrderStatusPill status={o.status} locale={locale} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/comenzi/noua" className={buttonVariants()}>
            {d.newLabel}
          </Link>
        }
      />

      <Toolbar>
        <form className="flex items-center gap-2">
          <Input
            name="q"
            placeholder={d.searchPlaceholder}
            defaultValue={q ?? ""}
            className="max-w-xs"
          />
          {status && <input type="hidden" name="stare" value={status} />}
          <Button type="submit" variant="outline">
            {d.filter}
          </Button>
        </form>
      </Toolbar>

      <FilterTabs options={filterOptions} active={status ?? ""} hrefFor={qs} />

      <DataTable
        columns={columns}
        rows={orders}
        getKey={(o) => o.id}
        onRowHref={(o) => `/dashboard/comenzi/${o.id}`}
        empty={d.notFound}
      />
    </div>
  );
}
