import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { getExpiringDocuments } from "@/lib/data/documents";
import { toDateKey } from "@/lib/documentStatus";
import { PageHeader } from "@/components/page-header";
import { ExpiryAlerts } from "@/components/expiry-alerts";

export default async function DashboardPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };

  const [company, expiring] = await Promise.all([
    getCompanyForSession(sessionUser),
    getExpiringDocuments(sessionUser, session!.user.companyId!),
  ]);

  const rows = expiring.map((document) => ({
    id: document.id,
    type: document.type,
    expiresAt: toDateKey(document.expiresAt),
    status: document.status,
    ownerLabel: document.ownerLabel,
    ownerHref: document.ownerHref,
  }));

  return (
    <div className="max-w-4xl">
      <PageHeader title={`Bine ai venit, ${session!.user.name}`} description={company?.name} />

      {company?.status === "TRIAL" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Firma ta este în așteptare de activare. Vei fi contactat în curând.
        </div>
      )}

      <ExpiryAlerts rows={rows} />
    </div>
  );
}
