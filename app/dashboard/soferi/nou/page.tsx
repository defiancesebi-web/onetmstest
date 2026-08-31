import Link from "next/link";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { DriverForm } from "../driver-form";
import { createDriverAction } from "../actions";

export default async function SoferNouPage() {
  const dict = await getDictionary();
  const t = dict.driverForm;
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/soferi" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        {t.back}
      </Link>
      <PageHeader title={t.newTitle} />
      <DriverForm action={createDriverAction} submitLabel={t.saveNew} t={t} />
    </div>
  );
}
