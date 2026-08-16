"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

const MESSAGES_BY_CODE: Record<string, string> = {
  account_disabled: "Acest cont a fost dezactivat.",
  company_suspended: "Firma ta este suspendată. Contactează administratorul.",
};

export async function loginAction(_prevState: { error: string | null }, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;
      return {
        error:
          (code && MESSAGES_BY_CODE[code]) ??
          "Email sau parolă incorectă, sau cont fără acces.",
      };
    }
    throw error;
  }
}
