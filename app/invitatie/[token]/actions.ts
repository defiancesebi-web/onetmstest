"use server";

import { acceptInvitation, InvalidInvitationError } from "@/lib/data/invitations";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function acceptInvitationAction(
  token: string,
  _prevState: { error: string | null },
  formData: FormData
) {
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;

  let email: string;
  try {
    const user = await acceptInvitation(token, { name, password });
    email = user.email;
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Cont creat, dar autentificarea automată a eșuat. Loghează-te manual." };
    }
    throw error;
  }
}
