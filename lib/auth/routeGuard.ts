import type { UserRole } from "@/lib/generated/prisma/enums";

export type RouteSession = { role: UserRole } | null;

export function decideRedirect(pathname: string, session: RouteSession): string | null {
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  // Account pages belong to the person, not to an area, so they are reachable
  // by every signed-in role — including SUPER_ADMIN, who is otherwise kept out
  // of /dashboard entirely and would have no way to change their own password.
  const isAccountRoute = pathname.startsWith("/parola");

  if ((isAdminRoute || isDashboardRoute || isAccountRoute) && !session) {
    return "/login";
  }
  if (isAccountRoute) {
    return null;
  }
  if (isAdminRoute && session && session.role !== "SUPER_ADMIN") {
    return "/dashboard";
  }
  if (isDashboardRoute && session && session.role === "SUPER_ADMIN") {
    return "/admin";
  }
  return null;
}
