"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { updateCompanySettings, ForbiddenError } from "@/lib/data/companies";

export type SettingsFormState = { error: string | null; saved: boolean };

function sessionUserOrThrow(session: Session | null) {
  if (!session?.user.companyId) throw new Error("Neautentificat");
  return { role: session.user.role, companyId: session.user.companyId };
}

export async function saveCompanySettingsAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  const clean = (key: string) => {
    const v = (formData.get(key) as string | null)?.trim();
    return v ? v : null;
  };

  // Logo: a client-resized square image data URL, or empty to clear. Reject
  // anything that isn't an image data URL, and cap the size (a 128px webp is a
  // few KB; ~400 KB is generous headroom before it bloats the row).
  const logoRaw = ((formData.get("logo") as string | null) ?? "").trim();
  let logo: string | null = null;
  if (logoRaw) {
    if (!logoRaw.startsWith("data:image/")) {
      return { error: "Logo invalid. Încarcă un fișier imagine.", saved: false };
    }
    if (logoRaw.length > 400_000) {
      return { error: "Logo prea mare. Alege o imagine mai mică.", saved: false };
    }
    logo = logoRaw;
  }

  try {
    await updateCompanySettings(sessionUser, {
      regCom: clean("regCom"),
      address: clean("address"),
      city: clean("city"),
      county: clean("county"),
      postalCode: clean("postalCode"),
      iban: clean("iban"),
      bankName: clean("bankName"),
      phone: clean("phone"),
      email: clean("email"),
      website: clean("website"),
      shareCapital: clean("shareCapital"),
      vatPayer: formData.get("vatPayer") === "on",
      invoiceSeries: clean("invoiceSeries"),
      logo,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message, saved: false };
    throw error;
  }

  revalidatePath("/dashboard/setari");
  revalidatePath("/dashboard/facturare");
  // The sidebar (in the dashboard layout) shows the company logo/name.
  revalidatePath("/dashboard", "layout");
  return { error: null, saved: true };
}
