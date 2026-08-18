"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createVehicle,
  updateVehicle,
  setVehicleActive,
  DuplicateRegistrationError,
  VehicleNotFoundError,
} from "@/lib/data/vehicles";
import { TenantAccessError } from "@/lib/tenancy";
import type { VehicleType } from "@/lib/generated/prisma/enums";

export type VehicleFormState = { error: string | null };

function readFields(formData: FormData) {
  const year = formData.get("manufactureYear") as string;
  return {
    registrationNumber: (formData.get("registrationNumber") as string).trim(),
    type: formData.get("type") as VehicleType,
    make: (formData.get("make") as string) || null,
    model: (formData.get("model") as string) || null,
    manufactureYear: year ? Number(year) : null,
    vin: (formData.get("vin") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await createVehicle(
      { role: session.user.role, companyId: session.user.companyId },
      { companyId: session.user.companyId, ...readFields(formData) }
    );
  } catch (error) {
    if (error instanceof DuplicateRegistrationError) return { error: error.message };
    throw error;
  }

  revalidatePath("/dashboard/flota");
  redirect("/dashboard/flota");
}

export async function updateVehicleAction(
  vehicleId: string,
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateVehicle(
      { role: session.user.role, companyId: session.user.companyId },
      vehicleId,
      readFields(formData)
    );
  } catch (error) {
    if (error instanceof DuplicateRegistrationError) return { error: error.message };
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof VehicleNotFoundError || error instanceof TenantAccessError) {
      return { error: new VehicleNotFoundError().message };
    }
    throw error;
  }

  revalidatePath(`/dashboard/flota/${vehicleId}`);
  revalidatePath("/dashboard/flota");
  return { error: null };
}

export async function setVehicleActiveAction(vehicleId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await setVehicleActive(
      { role: session.user.role, companyId: session.user.companyId },
      vehicleId,
      isActive
    );
  } catch (error) {
    // A stale row (already deleted, or another company's id) hits this; treat
    // it the same as "nothing to do" instead of throwing to the error page —
    // this action has no error channel (plain <form action>, no useActionState).
    if (error instanceof VehicleNotFoundError || error instanceof TenantAccessError) {
      revalidatePath(`/dashboard/flota/${vehicleId}`);
      revalidatePath("/dashboard/flota");
      return;
    }
    throw error;
  }

  revalidatePath(`/dashboard/flota/${vehicleId}`);
  revalidatePath("/dashboard/flota");
}
