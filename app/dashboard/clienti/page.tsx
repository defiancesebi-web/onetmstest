import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { ActivePill } from "@/components/active-pill";
import { DataTable, Toolbar, type Column } from "@/components/ui/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Client = Awaited<ReturnType<typeof listClients>>[number];

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactivi?: string }>;
}) {
  const { q, inactivi } = await searchParams;
  const session = await auth();
  const includeInactive = inactivi === "1";
  const dict = await getDictionary();
  const d = dict.customers;
  const c = dict.crud;

  const clients = await listClients(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { search: q, includeInactive },
  );

  const columns: Column<Client>[] = [
    {
      key: "name",
      header: d.colName,
      cell: (client) => (
        <Link href={`/dashboard/clienti/${client.id}`} className="text-primary font-semibold">
          {client.name}
        </Link>
      ),
    },
    {
      key: "cui",
      header: d.colCui,
      cell: (client) => <span className="text-muted-foreground">{client.cui}</span>,
    },
    { key: "city", header: d.colCity, cell: (client) => client.city },
    {
      key: "term",
      header: d.colPaymentTerm,
      cell: (client) => `${client.paymentTermDays} ${c.days}`,
    },
    {
      key: "status",
      header: c.status,
      cell: (client) => (
        <ActivePill active={client.isActive} activeLabel={c.active} inactiveLabel={c.inactive} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/clienti/nou" className={buttonVariants()}>
            {d.newLabel}
          </Link>
        }
      />

      <Toolbar>
        <form className="flex items-center gap-2">
          <Input name="q" placeholder={d.searchPlaceholder} defaultValue={q ?? ""} className="max-w-xs" />
          {includeInactive && <input type="hidden" name="inactivi" value="1" />}
          <Button type="submit" variant="outline">
            {c.search}
          </Button>
        </form>
        <Link
          href={includeInactive ? "/dashboard/clienti" : "/dashboard/clienti?inactivi=1"}
          className="text-primary ml-auto text-sm font-medium"
        >
          {includeInactive ? d.hideInactive : d.showInactive}
        </Link>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={clients}
        getKey={(client) => client.id}
        onRowHref={(client) => `/dashboard/clienti/${client.id}`}
        empty={d.notFound}
      />
    </div>
  );
}
