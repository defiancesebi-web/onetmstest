import Link from "next/link";
import { auth } from "@/auth";
import { listVehicles } from "@/lib/data/vehicles";
import { getOwnerStatuses } from "@/lib/data/documents";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { vehicleTypeLabel } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { ActivePill } from "@/components/active-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function FlotaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactive?: string }>;
}) {
  const { q, inactive } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const includeInactive = inactive === "1";
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.fleet;
  const c = dict.crud;

  const [vehicles, statuses] = await Promise.all([
    listVehicles(sessionUser, session!.user.companyId!, { search: q, includeInactive }),
    getOwnerStatuses(sessionUser, session!.user.companyId!),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/flota/nou" className={buttonVariants()}>
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
          href={includeInactive ? "/dashboard/flota" : "/dashboard/flota?inactive=1"}
          className="text-primary"
        >
          {includeInactive ? d.hideInactive : d.showInactive}
        </Link>
      </p>

      {vehicles.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {d.notFound}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{d.colNumber}</th>
                <th className="px-4 py-2 font-medium">{d.colType}</th>
                <th className="px-4 py-2 font-medium">{d.colMakeModel}</th>
                <th className="px-4 py-2 font-medium">{c.documents}</th>
                <th className="px-4 py-2 font-medium">{c.status}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/flota/${vehicle.id}`} className="text-primary font-medium">
                      {vehicle.registrationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{vehicleTypeLabel(vehicle.type, locale)}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge
                      status={statuses.vehicles[vehicle.id] ?? "NO_DOCUMENTS"}
                      locale={locale}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <ActivePill active={vehicle.isActive} activeLabel={c.active} inactiveLabel={c.inactive} />
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
