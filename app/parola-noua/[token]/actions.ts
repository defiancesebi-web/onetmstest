"use server";

import { consumePasswordResetToken, InvalidResetTokenError } from "@/lib/data/passwordReset";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export type ResetPasswordState = { error: string | null };

export async function resetPasswordAction(
  token: string,
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = formData.get("password") as string;
  const confirmation = formData.get("passwordConfirmation") as string;

  if (password !== confirmation) {
    return { error: "Cele două parole nu coincid." };
  }

  let email: string;
  try {
    const user = await consumePasswordResetToken(token, password);
    email = user.email;
  } catch (error) {
    if (error instanceof InvalidResetTokenError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Parola a fost schimbată, dar autentificarea automată a eșuat. Loghează-te manual.",
      };
    }
    throw error;
  }
}
