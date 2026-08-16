import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";

export default async function DashboardPage() {
  const session = await auth();
  const company = await getCompanyForSession({
    role: session!.user.role,
    companyId: session!.user.companyId,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bine ai venit, {session!.user.name}</h1>
      {company?.status === "TRIAL" && (
        <p className="mt-2 text-amber-600">
          Firma ta este în așteptare de activare. Vei fi contactat în curând.
        </p>
      )}
    </div>
  );
}
