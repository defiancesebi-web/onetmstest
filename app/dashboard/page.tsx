import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { PageHeader } from "@/components/page-header";

export default async function DashboardPage() {
  const session = await auth();
  const company = await getCompanyForSession({
    role: session!.user.role,
    companyId: session!.user.companyId,
  });

  return (
    <div>
      <PageHeader title={`Bine ai venit, ${session!.user.name}`} description={company?.name} />
      {company?.status === "TRIAL" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Firma ta este în așteptare de activare. Vei fi contactat în curând.
        </div>
      )}
    </div>
  );
}
