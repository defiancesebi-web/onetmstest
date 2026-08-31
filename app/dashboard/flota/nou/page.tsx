import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "../vehicle-form";
import { createVehicleAction } from "../actions";

export default async function VehiculNouPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.vehicleForm;
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/flota" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        {t.back}
      </Link>
      <PageHeader title={t.newTitle} />
      <VehicleForm action={createVehicleAction} submitLabel={t.saveNew} t={t} locale={locale} />
    </div>
  );
}
