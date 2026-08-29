"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import type { Currency } from "@/lib/generated/prisma/enums";
import {
  createInvoice,
  issueInvoice,
  markInvoicePaid,
  cancelInvoice,
  deleteInvoiceDraft,
  InvoiceValidationError,
  InvoiceIssuerIncompleteError,
  InvoiceStateError,
  type InvoiceLineInput,
} from "@/lib/data/invoices";

export type InvoiceFormState = { error: string | null };

function sessionUserOrThrow(session: Session | null) {
  if (!session?.user.companyId) throw new Error("Neautentificat");
  return { role: session.user.role, companyId: session.user.companyId };
}

export async function createInvoiceAction(
  _prev: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);

  let lines: InvoiceLineInput[];
  try {
    lines = JSON.parse((formData.get("lines") as string) || "[]");
  } catch {
    return { error: "Liniile facturii nu au putut fi citite." };
  }

  const clientId = (formData.get("clientId") as string) || null;
  const issueNow = formData.get("intent") === "issue";

  let invoiceId: string;
  try {
    const invoice = await createInvoice(sessionUser, sessionUser.companyId, {
      clientId,
      buyer: {
        name: (formData.get("buyerName") as string) || "",
        cui: (formData.get("buyerCui") as string) || "",
        regCom: (formData.get("buyerRegCom") as string) || null,
        address: (formData.get("buyerAddress") as string) || "",
        city: (formData.get("buyerCity") as string) || "",
        county: (formData.get("buyerCounty") as string) || null,
        country: (formData.get("buyerCountry") as string) || "România",
      },
      issueDate: formData.get("issueDate") as string,
      dueDate: formData.get("dueDate") as string,
      currency: (formData.get("currency") as Currency) || "RON",
      exchangeRate: (formData.get("exchangeRate") as string) || null,
      orderIds: ((formData.get("orderIds") as string) || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: (formData.get("notes") as string) || null,
      lines,
      issueNow,
    });
    invoiceId = invoice.id;
  } catch (error) {
    if (
      error instanceof InvoiceValidationError ||
      error instanceof InvoiceIssuerIncompleteError
    ) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/dashboard/facturare");
  redirect(`/dashboard/facturare/${invoiceId}`);
}

async function mutateInvoice(
  invoiceId: string,
  fn: (sessionUser: { role: "SUPER_ADMIN" | "COMPANY_ADMIN" | "COMPANY_USER"; companyId: string }) => Promise<unknown>
): Promise<InvoiceFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await fn(sessionUser);
  } catch (error) {
    if (
      error instanceof InvoiceStateError ||
      error instanceof InvoiceIssuerIncompleteError
    ) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath("/dashboard/facturare");
  revalidatePath(`/dashboard/facturare/${invoiceId}`);
  return { error: null };
}

export async function issueInvoiceAction(invoiceId: string): Promise<InvoiceFormState> {
  return mutateInvoice(invoiceId, (s) => issueInvoice(s, invoiceId));
}

export async function markPaidAction(invoiceId: string): Promise<InvoiceFormState> {
  return mutateInvoice(invoiceId, (s) => markInvoicePaid(s, invoiceId));
}

export async function cancelInvoiceAction(invoiceId: string): Promise<InvoiceFormState> {
  return mutateInvoice(invoiceId, (s) => cancelInvoice(s, invoiceId));
}

export async function deleteDraftAction(invoiceId: string): Promise<InvoiceFormState> {
  const session = await auth();
  const sessionUser = sessionUserOrThrow(session);
  try {
    await deleteInvoiceDraft(sessionUser, invoiceId);
  } catch (error) {
    if (error instanceof InvoiceStateError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard/facturare");
  redirect("/dashboard/facturare");
}
