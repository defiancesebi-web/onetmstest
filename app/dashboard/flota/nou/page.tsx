import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "../vehicle-form";
import { createVehicleAction } from "../actions";

export default async function VehiculNouPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.vehicleForm;
  return (
    <div>
      <Link href="/dashboard/flota" className="text-muted-foreground mb-4 inline-block text-sm underline">
        {t.back}
      </Link>
      <PageHeader title={t.newTitle} />
      <VehicleForm action={createVehicleAction} submitLabel={t.saveNew} t={t} locale={locale} />
    </div>
  );
}
