import { auth } from "@/auth";
import { getUsersForCompany } from "@/lib/data/users";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";

export default async function EchipaPage() {
  const session = await auth();
  const users = await getUsersForCompany(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Echipă"
        description="Utilizatorii care au acces la contul firmei tale."
      />

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

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium">Invită un coleg</h2>
        <InviteForm />
      </div>
    </div>
  );
}
