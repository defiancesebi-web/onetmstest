import Link from "next/link";
import { auth } from "@/auth";
import { listDrivers } from "@/lib/data/drivers";
import { getOwnerStatuses } from "@/lib/data/documents";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { ActivePill } from "@/components/active-pill";
import { DataTable, Toolbar, type Column } from "@/components/ui/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Driver = Awaited<ReturnType<typeof listDrivers>>[number];

export default async function SoferiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactive?: string }>;
}) {
  const { q, inactive } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const includeInactive = inactive === "1";
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.drivers;
  const c = dict.crud;

  const [drivers, statuses] = await Promise.all([
    listDrivers(sessionUser, session!.user.companyId!, { search: q, includeInactive }),
    getOwnerStatuses(sessionUser, session!.user.companyId!),
  ]);

  const columns: Column<Driver>[] = [
    {
      key: "name",
      header: d.colName,
      cell: (driver) => (
        <Link href={`/dashboard/soferi/${driver.id}`} className="text-primary font-semibold">
          {driver.lastName} {driver.firstName}
        </Link>
      ),
    },
    {
      key: "phone",
      header: d.colPhone,
      cell: (driver) => <span className="text-muted-foreground">{driver.phone ?? "—"}</span>,
    },
    {
      key: "documents",
      header: c.documents,
      cell: (driver) => (
        <DocumentStatusBadge
          status={statuses.drivers[driver.id] ?? "NO_DOCUMENTS"}
          locale={locale}
        />
      ),
    },
    {
      key: "status",
      header: c.status,
      cell: (driver) => (
        <ActivePill active={driver.isActive} activeLabel={c.active} inactiveLabel={c.inactive} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/soferi/nou" className={buttonVariants()}>
            {d.newLabel}
          </Link>
        }
      />

      <Toolbar>
        <form className="flex items-center gap-2">
          <Input name="q" placeholder={d.searchPlaceholder} defaultValue={q ?? ""} className="max-w-xs" />
          {includeInactive && <input type="hidden" name="inactive" value="1" />}
          <Button type="submit" variant="outline">
            {c.search}
          </Button>
        </form>
        <Link
          href={includeInactive ? "/dashboard/soferi" : "/dashboard/soferi?inactive=1"}
          className="text-primary ml-auto text-sm font-medium"
        >
          {includeInactive ? d.hideInactive : d.showInactive}
        </Link>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={drivers}
        getKey={(driver) => driver.id}
        onRowHref={(driver) => `/dashboard/soferi/${driver.id}`}
        empty={d.notFound}
      />
    </div>
  );
}
