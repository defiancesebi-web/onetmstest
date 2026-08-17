import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export default function ClientNouPage() {
  return (
    <div>
      <Link href="/dashboard/clienti" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la clienți
      </Link>
      <PageHeader title="Client nou" />
      <ClientForm action={createClientAction} submitLabel="Salvează clientul" />
    </div>
  );
}
