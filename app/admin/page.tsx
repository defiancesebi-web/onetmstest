import Link from "next/link";
import { auth } from "@/auth";
import { listCompaniesForSuperAdmin } from "@/lib/data/companies";
import { setCompanyStatusAction } from "./actions";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  const session = await auth();
  const companies = await listCompaniesForSuperAdmin({ role: session!.user.role });

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Firme înregistrate"
        description={`${companies.length} ${companies.length === 1 ? "firmă" : "firme"} pe platformă`}
      />

      {companies.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Nicio firmă înregistrată încă.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Nume</th>
                <th className="px-4 py-2 font-medium">CUI</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/admin/firme/${company.id}`} className="underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{company.cui}</td>
                  <td className="px-4 py-2">
                    <Badge>{company.status}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <form action={setCompanyStatusAction.bind(null, company.id, "ACTIVE")}>
                        <Button size="sm" variant="outline" type="submit">
                          Activează
                        </Button>
                      </form>
                      <form action={setCompanyStatusAction.bind(null, company.id, "SUSPENDED")}>
                        <Button size="sm" variant="destructive" type="submit">
                          Suspendă
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
