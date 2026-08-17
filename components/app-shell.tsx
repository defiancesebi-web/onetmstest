import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/app/actions/logout";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/generated/prisma/enums";

type NavItem = {
  href: string;
  label: string;
  /** Omitted means every role that reaches this shell sees the item. */
  roles?: UserRole[];
};

const COMPANY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/comenzi", label: "Comenzi" },
  { href: "/dashboard/clienti", label: "Clienți" },
  { href: "/dashboard/echipa", label: "Echipă", roles: ["COMPANY_ADMIN"] },
];

const ADMIN_NAV: NavItem[] = [{ href: "/admin", label: "Firme" }];

export async function AppShell({
  area,
  children,
}: {
  area: "company" | "admin";
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session!.user.role;
  const items = (area === "admin" ? ADMIN_NAV : COMPANY_NAV).filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <div className="flex min-h-screen">
      <aside className="bg-muted/40 flex w-56 shrink-0 flex-col border-r">
        <div className="border-b px-4 py-4">
          <Link href={area === "admin" ? "/admin" : "/dashboard"} className="font-semibold">
            ONE x TMS
          </Link>
          {area === "admin" && (
            <p className="text-muted-foreground mt-0.5 text-xs">Administrare platformă</p>
          )}
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:bg-muted rounded-md px-3 py-2 text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b px-6 py-3">
          <span className="text-muted-foreground text-sm">{session!.user.name}</span>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Delogare
            </Button>
          </form>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
