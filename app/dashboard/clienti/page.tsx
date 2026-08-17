import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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

  const clients = await listClients(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { search: q, includeInactive }
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Clienți"
        description="Firmele care îți trimit comenzi de transport."
        actions={
          // This project's Button is built on Base UI, which has no `asChild`;
          // styling the Link with buttonVariants is the supported way.
          <Link href="/dashboard/clienti/nou" className={buttonVariants()}>
            Client nou
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-2">
        <Input name="q" placeholder="Caută după nume sau CUI" defaultValue={q ?? ""} />
        {includeInactive && <input type="hidden" name="inactivi" value="1" />}
        <Button type="submit" variant="outline">
          Caută
        </Button>
      </form>

      <p className="mb-4 text-sm">
        <Link
          href={includeInactive ? "/dashboard/clienti" : "/dashboard/clienti?inactivi=1"}
          className="underline"
        >
          {includeInactive ? "Ascunde clienții inactivi" : "Arată și clienții inactivi"}
        </Link>
      </p>

      {clients.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Niciun client. Adaugă primul client ca să poți crea comenzi.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Nume</th>
                <th className="px-4 py-2 font-medium">CUI</th>
                <th className="px-4 py-2 font-medium">Oraș</th>
                <th className="px-4 py-2 font-medium">Termen plată</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/clienti/${client.id}`} className="underline">
                      {client.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{client.cui}</td>
                  <td className="px-4 py-2">{client.city}</td>
                  <td className="px-4 py-2">{client.paymentTermDays} zile</td>
                  <td className="px-4 py-2">
                    <Badge>{client.isActive ? "Activ" : "Inactiv"}</Badge>
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
