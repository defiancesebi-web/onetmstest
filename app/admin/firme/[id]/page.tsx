import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUsersForCompany } from "@/lib/data/users";
import { TenantAccessError } from "@/lib/tenancy";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  let users;
  try {
    users = await getUsersForCompany(
      { role: session!.user.role, companyId: session!.user.companyId },
      id
    );
  } catch (error) {
    if (error instanceof TenantAccessError) notFound();
    throw error;
  }

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted">
        ← Înapoi la firme
      </Link>

      <PageHeader
        title={company.name}
        description={
          <>
            CUI: {company.cui} · Status: <Badge>{company.status}</Badge>
          </>
        }
      />

      <h2 className="mb-3 text-sm font-medium">Utilizatori</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-4 py-2 font-medium">Nume</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2">{u.name}</td>
                <td className="text-muted-foreground px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  {u.role === "COMPANY_ADMIN" ? "Admin firmă" : "Utilizator"}
                </td>
                <td className="px-4 py-2">
                  <Badge>{u.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
