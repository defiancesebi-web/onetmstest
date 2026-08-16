import type { UserRole } from "@/lib/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: UserRole;
    companyId: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      companyId: string | null;
    };
  }
}

// next-auth/jwt only re-exports @auth/core/jwt, so augmenting it there is what
// actually widens the JWT interface Auth.js uses at runtime.
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    companyId: string | null;
  }
}
