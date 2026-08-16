"use server";

import { registerCompany, EmailAlreadyExistsError } from "@/lib/data/registerCompany";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function registerAction(_prevState: { error: string | null }, formData: FormData) {
  const companyName = formData.get("companyName") as string;
  const cui = formData.get("cui") as string;
  const adminName = formData.get("adminName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await registerCompany({ companyName, cui, adminName, email, password });
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Firma a fost creată, dar autentificarea automată a eșuat. Încearcă să te loghezi manual." };
    }
    throw error;
  }
}
