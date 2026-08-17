import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DriverForm } from "../driver-form";
import { createDriverAction } from "../actions";

export default function SoferNouPage() {
  return (
    <div>
      <Link href="/dashboard/soferi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la șoferi
      </Link>
      <PageHeader title="Șofer nou" />
      <DriverForm action={createDriverAction} submitLabel="Salvează șoferul" />
    </div>
  );
}
