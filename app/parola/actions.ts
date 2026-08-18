"use server";

import { auth } from "@/auth";
import { changeOwnPassword, WrongCurrentPasswordError } from "@/lib/data/passwordReset";

export type ChangePasswordState = { error: string | null; changed: boolean };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user.id) throw new Error("Neautentificat");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmation = formData.get("newPasswordConfirmation") as string;

  if (newPassword !== confirmation) {
    return { error: "Cele două parole noi nu coincid.", changed: false };
  }

  try {
    // Always the session's own id — never one taken from the form, which the
    // browser controls.
    await changeOwnPassword(session.user.id, currentPassword, newPassword);
  } catch (error) {
    if (error instanceof WrongCurrentPasswordError) {
      return { error: error.message, changed: false };
    }
    throw error;
  }

  return { error: null, changed: true };
}
