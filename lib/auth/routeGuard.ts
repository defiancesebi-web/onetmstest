import type { UserRole } from "@/lib/generated/prisma/enums";

export type RouteSession = { role: UserRole } | null;

export function decideRedirect(pathname: string, session: RouteSession): string | null {
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");

  if ((isAdminRoute || isDashboardRoute) && !session) {
    return "/login";
  }
  if (isAdminRoute && session && session.role !== "SUPER_ADMIN") {
    return "/dashboard";
  }
  if (isDashboardRoute && session && session.role === "SUPER_ADMIN") {
    return "/admin";
  }
  return null;
}
