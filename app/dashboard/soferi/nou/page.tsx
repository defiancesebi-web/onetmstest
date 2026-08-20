import Link from "next/link";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { DriverForm } from "../driver-form";
import { createDriverAction } from "../actions";

export default async function SoferNouPage() {
  const dict = await getDictionary();
  const t = dict.driverForm;
  return (
    <div>
      <Link href="/dashboard/soferi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        {t.back}
      </Link>
      <PageHeader title={t.newTitle} />
      <DriverForm action={createDriverAction} submitLabel={t.saveNew} t={t} />
    </div>
  );
}
