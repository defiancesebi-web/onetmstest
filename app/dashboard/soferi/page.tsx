import Link from "next/link";
import { auth } from "@/auth";
import { listDrivers } from "@/lib/data/drivers";
import { getOwnerStatuses } from "@/lib/data/documents";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { ActivePill } from "@/components/active-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/soferi/nou" className={buttonVariants()}>
            {d.newLabel}
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-2">
        <Input name="q" placeholder={d.searchPlaceholder} defaultValue={q ?? ""} className="max-w-xs" />
        {includeInactive && <input type="hidden" name="inactive" value="1" />}
        <Button type="submit" variant="outline">
          {c.search}
        </Button>
      </form>

      <p className="mb-4 text-sm">
        <Link
          href={includeInactive ? "/dashboard/soferi" : "/dashboard/soferi?inactive=1"}
          className="text-primary"
        >
          {includeInactive ? d.hideInactive : d.showInactive}
        </Link>
      </p>

      {drivers.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {d.notFound}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{d.colName}</th>
                <th className="px-4 py-2 font-medium">{d.colPhone}</th>
                <th className="px-4 py-2 font-medium">{c.documents}</th>
                <th className="px-4 py-2 font-medium">{c.status}</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/soferi/${driver.id}`} className="text-primary font-medium">
                      {driver.lastName} {driver.firstName}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{driver.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge
                      status={statuses.drivers[driver.id] ?? "NO_DOCUMENTS"}
                      locale={locale}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <ActivePill active={driver.isActive} activeLabel={c.active} inactiveLabel={c.inactive} />
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
