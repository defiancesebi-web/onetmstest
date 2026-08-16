import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginAllowed } from "@/lib/auth/checkLoginAllowed";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        });
        if (!user) return null;

        const passwordOk = await verifyPassword(password, user.passwordHash);
        if (!passwordOk) return null;

        const allowed = checkLoginAllowed(user, user.company);
        if (!allowed.ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        };
      },
    }),
  ],
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
});
