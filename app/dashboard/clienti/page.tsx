import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { ActivePill } from "@/components/active-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    { search: q, includeInactive }
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/clienti/nou" className={buttonVariants()}>
            {d.newLabel}
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-2">
        <Input name="q" placeholder={d.searchPlaceholder} defaultValue={q ?? ""} />
        {includeInactive && <input type="hidden" name="inactivi" value="1" />}
        <Button type="submit" variant="outline">
          {c.search}
        </Button>
      </form>

      <p className="mb-4 text-sm">
        <Link
          href={includeInactive ? "/dashboard/clienti" : "/dashboard/clienti?inactivi=1"}
          className="text-primary"
        >
          {includeInactive ? d.hideInactive : d.showInactive}
        </Link>
      </p>

      {clients.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {d.notFound}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{d.colName}</th>
                <th className="px-4 py-2 font-medium">{d.colCui}</th>
                <th className="px-4 py-2 font-medium">{d.colCity}</th>
                <th className="px-4 py-2 font-medium">{d.colPaymentTerm}</th>
                <th className="px-4 py-2 font-medium">{c.status}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/clienti/${client.id}`} className="text-primary font-medium">
                      {client.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{client.cui}</td>
                  <td className="px-4 py-2">{client.city}</td>
                  <td className="px-4 py-2">
                    {client.paymentTermDays} {c.days}
                  </td>
                  <td className="px-4 py-2">
                    <ActivePill active={client.isActive} activeLabel={c.active} inactiveLabel={c.inactive} />
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
