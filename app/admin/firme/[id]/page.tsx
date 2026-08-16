import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUsersForCompany } from "@/lib/data/users";
import { TenantAccessError } from "@/lib/tenancy";

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
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{company.name}</h1>
      <p className="text-muted-foreground">
        CUI: {company.cui} · Status: {company.status}
      </p>
      <h2 className="mb-2 mt-6 text-lg font-medium">Utilizatori</h2>
      <ul className="space-y-1">
        {users.map((u) => (
          <li key={u.id}>
            {u.name} — {u.email} ({u.role})
          </li>
        ))}
      </ul>
    </div>
  );
}
