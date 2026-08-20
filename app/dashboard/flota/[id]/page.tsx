import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getVehicleById } from "@/lib/data/vehicles";
import { listDocumentsForVehicle } from "@/lib/data/documents";
import { documentStatus, VEHICLE_DOCUMENT_TYPES, toDateKey } from "@/lib/documentStatus";
import { vehicleTypeLabel } from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DocumentsSection } from "@/components/documents-section";
import { VehicleForm } from "../vehicle-form";
import { updateVehicleAction, setVehicleActiveAction } from "../actions";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.vehicleForm;

  const vehicle = await getVehicleById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!vehicle) notFound();

  const documents = (
    await listDocumentsForVehicle(
      { role: session!.user.role, companyId: session!.user.companyId },
      vehicle.id
    )
  ).map((document) => ({
    id: document.id,
    type: document.type,
    number: document.number,
    issuedAt: document.issuedAt ? toDateKey(document.issuedAt) : null,
    expiresAt: toDateKey(document.expiresAt),
    status: documentStatus(document.expiresAt),
  }));

  const boundUpdate = updateVehicleAction.bind(null, vehicle.id);
  const boundToggle = setVehicleActiveAction.bind(null, vehicle.id, !vehicle.isActive);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/flota" className="text-muted-foreground mb-4 inline-block text-sm underline">
        {t.back}
      </Link>

      <PageHeader
        title={vehicle.registrationNumber}
        description={`${vehicleTypeLabel(vehicle.type, locale)}${vehicle.isActive ? "" : ` · ${t.inactive}`}`}
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={vehicle.isActive ? "destructive" : "outline"}>
              {vehicle.isActive ? t.deactivate : t.reactivate}
            </Button>
          </form>
        }
      />

      <VehicleForm action={boundUpdate} values={vehicle} submitLabel={t.saveChanges} t={t} locale={locale} />

      <DocumentsSection
        ownerKind="vehicle"
        ownerId={vehicle.id}
        ownerPath={`/dashboard/flota/${vehicle.id}`}
        availableTypes={VEHICLE_DOCUMENT_TYPES}
        documents={documents}
        locale={locale}
        labels={dict.docs}
      />
    </div>
  );
}
