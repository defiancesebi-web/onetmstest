import { auth } from "@/auth";
import { listCompaniesForSuperAdmin } from "@/lib/data/companies";
import { setCompanyStatusAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();
  const companies = await listCompaniesForSuperAdmin({ role: session!.user.role });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Firme înregistrate</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nume</th>
            <th className="py-2">CUI</th>
            <th className="py-2">Status</th>
            <th className="py-2">Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b">
              <td className="py-2">
                <Link href={`/admin/firme/${company.id}`} className="underline">
                  {company.name}
                </Link>
              </td>
              <td className="py-2">{company.cui}</td>
              <td className="py-2">
                <Badge>{company.status}</Badge>
              </td>
              <td className="space-x-2 py-2">
                <form action={setCompanyStatusAction.bind(null, company.id, "ACTIVE")} className="inline">
                  <Button size="sm" variant="outline" type="submit">
                    Activează
                  </Button>
                </form>
                <form action={setCompanyStatusAction.bind(null, company.id, "SUSPENDED")} className="inline">
                  <Button size="sm" variant="destructive" type="submit">
                    Suspendă
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
