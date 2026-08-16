"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(_prevState: { error: string | null }, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email sau parolă incorectă, sau cont fără acces." };
    }
    throw error;
  }
}
