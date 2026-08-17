import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "../vehicle-form";
import { createVehicleAction } from "../actions";

export default function VehiculNouPage() {
  return (
    <div>
      <Link href="/dashboard/flota" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la flotă
      </Link>
      <PageHeader title="Vehicul nou" />
      <VehicleForm action={createVehicleAction} submitLabel="Salvează vehiculul" />
    </div>
  );
}
