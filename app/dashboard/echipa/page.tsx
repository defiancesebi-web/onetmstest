import { auth } from "@/auth";
import { getUsersForCompany } from "@/lib/data/users";
import { InviteForm } from "./invite-form";

export default async function EchipaPage() {
  const session = await auth();
  const users = await getUsersForCompany(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Echipă</h1>
      <ul className="mb-8 space-y-2">
        {users.map((u) => (
          <li key={u.id} className="flex justify-between border-b py-2">
            <span>
              {u.name} ({u.email})
            </span>
            <span className="text-muted-foreground text-sm">
              {u.role} · {u.status}
            </span>
          </li>
        ))}
      </ul>
      <InviteForm />
    </div>
  );
}
