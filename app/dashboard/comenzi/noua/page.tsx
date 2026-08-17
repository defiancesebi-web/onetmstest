import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { OrderForm } from "./order-form";

export default async function ComandaNouaPage() {
  const session = await auth();
  const clients = await listClients(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  return (
    <div>
      <Link href="/dashboard/comenzi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la comenzi
      </Link>
      <PageHeader title="Comandă nouă" />

      {clients.length === 0 ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Nu ai niciun client activ. O comandă are nevoie de un client.
          </p>
          <Link href="/dashboard/clienti/nou" className={buttonVariants()}>
            Adaugă primul client
          </Link>
        </div>
      ) : (
        <OrderForm
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            paymentTermDays: c.paymentTermDays,
          }))}
        />
      )}
    </div>
  );
}
