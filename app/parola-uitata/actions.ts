"use server";

import { createPasswordResetToken } from "@/lib/data/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordReset";

export type ForgotPasswordState = { error: string | null; sent: boolean };

/**
 * Always reports the same outcome, whether or not the address has an account.
 * Telling the two apart would turn this form into a way to enumerate which
 * companies are on the platform.
 */
export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get("email") as string).trim();

  const token = await createPasswordResetToken(email);

  if (token) {
    try {
      await sendPasswordResetEmail(email, token);
    } catch {
      // The token is valid and stored; only delivery failed. Saying so would
      // leak that this address has an account, so the message stays uniform
      // and the failure is left to the server logs.
    }
  }

  return { error: null, sent: true };
}
