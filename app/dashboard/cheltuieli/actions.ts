"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import type {
  FixedCostCategory,
  FixedCostPeriod,
  ExpenseCategory,
} from "@/lib/generated/prisma/enums";
import {
  createFixedCost,
  updateFixedCost,
  setFixedCostActive,
  deleteFixedCost,
  createExpense,
  deleteExpense,
  ExpenseValidationError,
  ExpenseNotFoundError,
} from "@/lib/data/expenses";

export type ExpenseFormState = { error: string | null };

function sessionUserOrThrow(session: Session | null) {
  if (!session?.user.companyId) throw new Error("Neautentificat");
  return { role: session.user.role, companyId: session.user.companyId };
}

function readFixedCost(formData: FormData) {
  return {
    label: (formData.get("label") as string) || "",
    category: (formData.get("category") as FixedCostCategory) || "OTHER",
    period: (formData.get("period") as FixedCostPeriod) || "MONTHLY",
    amount: (formData.get("amount") as string) || "",
    vehicleId: (formData.get("vehicleId") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createFixedCostAction(
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await createFixedCost(sessionUser, sessionUser.companyId, readFixedCost(formData));
  } catch (error) {
    if (error instanceof ExpenseValidationError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/cheltuieli/fixe");
  revalidatePath("/dashboard/cheltuieli");
  redirect("/dashboard/cheltuieli/fixe");
}

export async function updateFixedCostAction(
  id: string,
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await updateFixedCost(sessionUser, id, readFixedCost(formData));
  } catch (error) {
    if (error instanceof ExpenseValidationError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/cheltuieli/fixe");
  revalidatePath("/dashboard/cheltuieli");
  redirect("/dashboard/cheltuieli/fixe");
}

export async function setFixedCostActiveAction(
  id: string,
  isActive: boolean
): Promise<ExpenseFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await setFixedCostActive(sessionUser, id, isActive);
  } catch (error) {
    if (error instanceof ExpenseNotFoundError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/cheltuieli/fixe");
  revalidatePath("/dashboard/cheltuieli");
  return { error: null };
}

export async function deleteFixedCostAction(id: string): Promise<ExpenseFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await deleteFixedCost(sessionUser, id);
  } catch (error) {
    if (error instanceof ExpenseNotFoundError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/cheltuieli/fixe");
  revalidatePath("/dashboard/cheltuieli");
  return { error: null };
}

export async function createExpenseAction(
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await createExpense(sessionUser, sessionUser.companyId, {
      date: (formData.get("date") as string) || "",
      category: (formData.get("category") as ExpenseCategory) || "OTHER",
      amount: (formData.get("amount") as string) || "",
      liters: (formData.get("liters") as string) || null,
      vehicleId: (formData.get("vehicleId") as string) || null,
      driverId: (formData.get("driverId") as string) || null,
      tripId: (formData.get("tripId") as string) || null,
      notes: (formData.get("notes") as string) || null,
    });
  } catch (error) {
    if (error instanceof ExpenseValidationError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/cheltuieli/variabile");
  revalidatePath("/dashboard/cheltuieli");
  redirect("/dashboard/cheltuieli/variabile");
}

export async function deleteExpenseAction(id: string): Promise<ExpenseFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await deleteExpense(sessionUser, id);
  } catch (error) {
    if (error instanceof ExpenseNotFoundError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/cheltuieli/variabile");
  revalidatePath("/dashboard/cheltuieli");
  return { error: null };
}
