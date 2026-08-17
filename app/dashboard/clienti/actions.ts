"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createClient,
  updateClient,
  setClientActive,
  DuplicateCuiError,
} from "@/lib/data/clients";

export type ClientFormState = {
  error: string | null;
  duplicateWarning: string | null;
};

function readClientFields(formData: FormData) {
  return {
    name: formData.get("name") as string,
    cui: formData.get("cui") as string,
    address: formData.get("address") as string,
    city: formData.get("city") as string,
    country: (formData.get("country") as string) || "România",
    contactName: (formData.get("contactName") as string) || null,
    contactPhone: (formData.get("contactPhone") as string) || null,
    contactEmail: (formData.get("contactEmail") as string) || null,
    paymentTermDays: Number(formData.get("paymentTermDays") || 45),
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const sessionUser = { role: session.user.role, companyId: session.user.companyId };

  try {
    await createClient(sessionUser, {
      companyId: session.user.companyId,
      ...readClientFields(formData),
      confirmDuplicateCui: formData.get("confirmDuplicateCui") === "true",
    });
  } catch (error) {
    if (error instanceof DuplicateCuiError) {
      return { error: null, duplicateWarning: error.message };
    }
    throw error;
  }

  revalidatePath("/dashboard/clienti");
  redirect("/dashboard/clienti");
}

export async function updateClientAction(
  clientId: string,
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await updateClient(
    { role: session.user.role, companyId: session.user.companyId },
    clientId,
    readClientFields(formData)
  );

  revalidatePath(`/dashboard/clienti/${clientId}`);
  revalidatePath("/dashboard/clienti");
  return { error: null, duplicateWarning: null };
}

export async function setClientActiveAction(clientId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await setClientActive(
    { role: session.user.role, companyId: session.user.companyId },
    clientId,
    isActive
  );

  revalidatePath(`/dashboard/clienti/${clientId}`);
  revalidatePath("/dashboard/clienti");
}
