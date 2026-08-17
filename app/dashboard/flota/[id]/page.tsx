import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getVehicleById } from "@/lib/data/vehicles";
import { VEHICLE_TYPE_LABELS } from "@/lib/documentStatus";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { VehicleForm } from "../vehicle-form";
import { updateVehicleAction, setVehicleActiveAction } from "../actions";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const vehicle = await getVehicleById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!vehicle) notFound();

  const boundUpdate = updateVehicleAction.bind(null, vehicle.id);
  const boundToggle = setVehicleActiveAction.bind(null, vehicle.id, !vehicle.isActive);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/flota" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la flotă
      </Link>

      <PageHeader
        title={vehicle.registrationNumber}
        description={`${VEHICLE_TYPE_LABELS[vehicle.type]}${vehicle.isActive ? "" : " · Inactiv"}`}
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={vehicle.isActive ? "destructive" : "outline"}>
              {vehicle.isActive ? "Dezactivează" : "Reactivează"}
            </Button>
          </form>
        }
      />

      <VehicleForm action={boundUpdate} values={vehicle} submitLabel="Salvează modificările" />
    </div>
  );
}
