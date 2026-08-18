"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createDriver,
  updateDriver,
  setDriverActive,
  DriverNotFoundError,
} from "@/lib/data/drivers";
import { TenantAccessError } from "@/lib/tenancy";

export type DriverFormState = { error: string | null };

function readFields(formData: FormData) {
  const hired = formData.get("hiredAt") as string;
  return {
    firstName: (formData.get("firstName") as string).trim(),
    lastName: (formData.get("lastName") as string).trim(),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    personalId: (formData.get("personalId") as string) || null,
    hiredAt: hired ? new Date(hired) : null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createDriverAction(
  _prevState: DriverFormState,
  formData: FormData
): Promise<DriverFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await createDriver(
    { role: session.user.role, companyId: session.user.companyId },
    { companyId: session.user.companyId, ...readFields(formData) }
  );

  revalidatePath("/dashboard/soferi");
  redirect("/dashboard/soferi");
}

export async function updateDriverAction(
  driverId: string,
  _prevState: DriverFormState,
  formData: FormData
): Promise<DriverFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateDriver(
      { role: session.user.role, companyId: session.user.companyId },
      driverId,
      readFields(formData)
    );
  } catch (error) {
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof DriverNotFoundError || error instanceof TenantAccessError) {
      return { error: new DriverNotFoundError().message };
    }
    throw error;
  }

  revalidatePath(`/dashboard/soferi/${driverId}`);
  revalidatePath("/dashboard/soferi");
  return { error: null };
}

export async function setDriverActiveAction(driverId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await setDriverActive(
      { role: session.user.role, companyId: session.user.companyId },
      driverId,
      isActive
    );
  } catch (error) {
    // A stale row (already deleted, or another company's id) hits this; treat
    // it the same as "nothing to do" instead of throwing to the error page —
    // this action has no error channel (plain <form action>, no useActionState).
    if (error instanceof DriverNotFoundError || error instanceof TenantAccessError) {
      revalidatePath(`/dashboard/soferi/${driverId}`);
      revalidatePath("/dashboard/soferi");
      return;
    }
    throw error;
  }

  revalidatePath(`/dashboard/soferi/${driverId}`);
  revalidatePath("/dashboard/soferi");
}
