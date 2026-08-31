import { auth } from "@/auth";
import { getUsersForCompany } from "@/lib/data/users";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";

export default async function EchipaPage() {
  const session = await auth();
  const dict = await getDictionary();
  const t = dict.team;
  const users = await getUsersForCompany(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} description={t.description} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="px-4 py-2 font-medium">{t.colName}</th>
              <th className="px-4 py-2 font-medium">{t.colEmail}</th>
              <th className="px-4 py-2 font-medium">{t.colRole}</th>
              <th className="px-4 py-2 font-medium">{t.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2">{u.name}</td>
                <td className="text-muted-foreground px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  {u.role === "COMPANY_ADMIN" ? t.roleAdmin : t.roleUser}
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
        <h2 className="mb-3 text-sm font-medium">{t.inviteHeading}</h2>
        <InviteForm
          labels={{
            emailPlaceholder: t.emailPlaceholder,
            roleUser: t.roleUser,
            roleAdmin: t.roleAdmin,
            invite: t.invite,
          }}
        />
      </div>
    </div>
  );
}
