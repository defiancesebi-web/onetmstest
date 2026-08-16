import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginAllowed } from "@/lib/auth/checkLoginAllowed";

// Auth.js collapses a null from authorize() into one generic error, which would
// hide *why* a valid password was refused. These carry the reason through as a
// code the login page maps back to an explicit message. Only thrown after the
// password already verified, so they reveal nothing to someone guessing emails.
export class AccountDisabledError extends CredentialsSignin {
  code = "account_disabled";
}

export class CompanySuspendedError extends CredentialsSignin {
  code = "company_suspended";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
        if (!allowed.ok) {
          throw user.status === "DISABLED"
            ? new AccountDisabledError()
            : new CompanySuspendedError();
        }

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
});
