import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { type Dictionary } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { DashboardChrome, type ChromeNavItem } from "@/components/dashboard-chrome";
import type { UserRole } from "@/lib/generated/prisma/enums";

type NavKey = keyof Dictionary["nav"];
type NavDef = { key: NavKey; href: string; built: boolean; roles?: UserRole[] };

// The full navigation from the design. Built items link to their real routes;
// the rest point at the shared "coming soon" placeholder until their module is
// implemented. Order matches the reference sidebar.
const COMPANY_NAV: NavDef[] = [
  { key: "dashboard", href: "/dashboard", built: true },
  { key: "loads", href: "/dashboard/comenzi", built: true },
  { key: "planning", href: "/dashboard/curand/planning", built: false },
  { key: "dispatch", href: "/dashboard/dispecerat", built: true },
  { key: "tracking", href: "/dashboard/curand/tracking", built: false },
  { key: "vehicles", href: "/dashboard/flota", built: true },
  { key: "drivers", href: "/dashboard/soferi", built: true },
  { key: "customers", href: "/dashboard/clienti", built: true },
  { key: "carriers", href: "/dashboard/curand/carriers", built: false },
  { key: "invoices", href: "/dashboard/curand/invoices", built: false },
  { key: "documents", href: "/dashboard/documente", built: true },
  { key: "reports", href: "/dashboard/curand/reports", built: false },
  { key: "analytics", href: "/dashboard/curand/analytics", built: false },
  { key: "team", href: "/dashboard/echipa", built: true, roles: ["COMPANY_ADMIN"] },
  { key: "settings", href: "/dashboard/curand/settings", built: false },
];

const ROLE_LABELS: Record<UserRole, { ro: string; en: string }> = {
  SUPER_ADMIN: { ro: "Super Admin", en: "Super Admin" },
  COMPANY_ADMIN: { ro: "Administrator", en: "Admin" },
  COMPANY_USER: { ro: "Utilizator", en: "User" },
};

export async function AppShell({
  area,
  children,
}: {
  area: "company" | "admin";
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session!.user.role;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  const company =
    area === "company"
      ? await getCompanyForSession({ role, companyId: session!.user.companyId })
      : null;

  const items: ChromeNavItem[] =
    area === "admin"
      ? [
          {
            key: "dashboard",
            href: "/admin",
            label: locale === "ro" ? "Firme" : "Companies",
            built: true,
          },
        ]
      : COMPANY_NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => ({
          key: item.key,
          href: item.href,
          label: dict.nav[item.key],
          built: item.built,
        }));

  return (
    <DashboardChrome
      items={items}
      brandSub={area === "admin" ? dict.topbar.platform : (company?.name ?? "")}
      user={{ name: session!.user.name ?? "", roleLabel: ROLE_LABELS[role][locale] }}
      locale={locale}
      labels={{
        search: dict.topbar.search,
        collapse: dict.nav.collapse,
        expand: dict.nav.expand,
        soon: dict.nav.soon,
        logout: dict.topbar.logout,
        changePassword: dict.topbar.changePassword,
      }}
    >
      {children}
    </DashboardChrome>
  );
}
