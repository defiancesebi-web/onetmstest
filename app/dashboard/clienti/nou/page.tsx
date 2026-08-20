import Link from "next/link";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export default async function ClientNouPage() {
  const dict = await getDictionary();
  const t = dict.customerForm;
  return (
    <div>
      <Link href="/dashboard/clienti" className="text-muted-foreground mb-4 inline-block text-sm underline">
        {t.back}
      </Link>
      <PageHeader title={t.newTitle} />
      <ClientForm action={createClientAction} submitLabel={t.saveNew} t={t} />
    </div>
  );
}
