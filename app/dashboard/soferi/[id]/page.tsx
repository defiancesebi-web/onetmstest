import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDriverById } from "@/lib/data/drivers";
import { listDocumentsForDriver } from "@/lib/data/documents";
import { documentStatus, DRIVER_DOCUMENT_TYPES, toDateKey } from "@/lib/documentStatus";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DocumentsSection } from "@/components/documents-section";
import { DriverForm } from "../driver-form";
import { updateDriverAction, setDriverActiveAction } from "../actions";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.driverForm;

  const driver = await getDriverById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!driver) notFound();

  const documents = (
    await listDocumentsForDriver(
      { role: session!.user.role, companyId: session!.user.companyId },
      driver.id
    )
  ).map((document) => ({
    id: document.id,
    type: document.type,
    number: document.number,
    issuedAt: document.issuedAt ? toDateKey(document.issuedAt) : null,
    expiresAt: toDateKey(document.expiresAt),
    status: documentStatus(document.expiresAt),
  }));

  const boundUpdate = updateDriverAction.bind(null, driver.id);
  const boundToggle = setDriverActiveAction.bind(null, driver.id, !driver.isActive);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/soferi" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        {t.back}
      </Link>

      <PageHeader
        title={`${driver.lastName} ${driver.firstName}`}
        description={driver.isActive ? undefined : t.inactive}
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={driver.isActive ? "destructive" : "outline"}>
              {driver.isActive ? t.deactivate : t.reactivate}
            </Button>
          </form>
        }
      />

      <DriverForm action={boundUpdate} values={driver} submitLabel={t.saveChanges} t={t} />

      <DocumentsSection
        ownerKind="driver"
        ownerId={driver.id}
        ownerPath={`/dashboard/soferi/${driver.id}`}
        availableTypes={DRIVER_DOCUMENT_TYPES}
        documents={documents}
        locale={locale}
        labels={dict.docs}
      />
    </div>
  );
}
