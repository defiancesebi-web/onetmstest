import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { decideRedirect } from "@/lib/auth/routeGuard";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth ? { role: req.auth.user.role } : null;
  const redirectTo = decideRedirect(req.nextUrl.pathname, session);

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/parola"],
};
