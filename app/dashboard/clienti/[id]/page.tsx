import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getClientById } from "@/lib/data/clients";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientForm } from "../client-form";
import { updateClientAction, setClientActiveAction } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const client = await getClientById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!client) notFound();

  const boundUpdate = updateClientAction.bind(null, client.id);
  const boundToggle = setClientActiveAction.bind(null, client.id, !client.isActive);

  return (
    <div>
      <Link href="/dashboard/clienti" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la clienți
      </Link>

      <PageHeader
        title={client.name}
        description={
          <>
            CUI: {client.cui} · <Badge>{client.isActive ? "Activ" : "Inactiv"}</Badge>
          </>
        }
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={client.isActive ? "destructive" : "outline"}>
              {client.isActive ? "Dezactivează" : "Reactivează"}
            </Button>
          </form>
        }
      />

      <ClientForm action={boundUpdate} values={client} submitLabel="Salvează modificările" />
    </div>
  );
}
