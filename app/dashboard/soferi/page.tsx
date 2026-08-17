import Link from "next/link";
import { auth } from "@/auth";
import { listDrivers } from "@/lib/data/drivers";
import { getOwnerStatuses } from "@/lib/data/documents";
import { PageHeader } from "@/components/page-header";
import { DocumentStatusBadge } from "@/components/document-status-badge";
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

  const [drivers, statuses] = await Promise.all([
    listDrivers(sessionUser, session!.user.companyId!, { search: q, includeInactive }),
    getOwnerStatuses(sessionUser, session!.user.companyId!),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Șoferi"
        description="Șoferii firmei și starea documentelor lor."
        actions={
          <Link href="/dashboard/soferi/nou" className={buttonVariants()}>
            Șofer nou
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-2">
        <Input name="q" placeholder="Caută după nume" defaultValue={q ?? ""} className="max-w-xs" />
        {includeInactive && <input type="hidden" name="inactive" value="1" />}
        <Button type="submit" variant="outline">
          Caută
        </Button>
      </form>

      <p className="mb-4 text-sm">
        <Link
          href={includeInactive ? "/dashboard/soferi" : "/dashboard/soferi?inactive=1"}
          className="underline"
        >
          {includeInactive ? "Ascunde șoferii inactivi" : "Arată și șoferii inactivi"}
        </Link>
      </p>

      {drivers.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Niciun șofer. Adaugă primul șofer ca să poți urmări documentele lui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Nume</th>
                <th className="px-4 py-2 font-medium">Telefon</th>
                <th className="px-4 py-2 font-medium">Documente</th>
                <th className="px-4 py-2 font-medium">Stare</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/soferi/${driver.id}`} className="underline">
                      {driver.lastName} {driver.firstName}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{driver.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={statuses.drivers[driver.id] ?? "NO_DOCUMENTS"} />
                  </td>
                  <td className="px-4 py-2">{driver.isActive ? "Activ" : "Inactiv"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
