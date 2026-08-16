import type { NextAuthConfig } from "next-auth";

// Edge-safe half of the Auth.js config: no providers, no Prisma. The
// middleware runs in the Edge runtime and can only import this file;
// auth.ts adds the Credentials provider (which needs Prisma) on top.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.role = token.role;
      session.user.companyId = token.companyId;
      return session;
    },
  },
};
