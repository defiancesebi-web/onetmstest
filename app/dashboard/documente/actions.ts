"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createDocument,
  updateDocument,
  deleteDocument,
  InvalidDocumentOwnerError,
  DocumentNotFoundError,
} from "@/lib/data/documents";
import { TenantAccessError } from "@/lib/tenancy";
import type { DocumentType } from "@/lib/generated/prisma/enums";

export type DocumentFormState = { error: string | null };

function parseDate(value: FormDataEntryValue | null): Date | null {
  const text = value as string;
  if (!text) return null;
  // A date input gives "YYYY-MM-DD"; anchoring at UTC midnight keeps the stored
  // calendar day identical to what the user picked.
  const parsed = new Date(`${text}T00:00:00Z`);
  // An unparsable string produces an Invalid Date object, which is truthy —
  // `if (!expiresAt)` below would let it through to Prisma, which throws a
  // raw error to the generic error page instead of the Romanian message.
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function ownerPath(formData: FormData) {
  const vehicleId = (formData.get("vehicleId") as string) || null;
  const driverId = (formData.get("driverId") as string) || null;
  return vehicleId ? `/dashboard/flota/${vehicleId}` : `/dashboard/soferi/${driverId}`;
}

export async function createDocumentAction(
  _prevState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const expiresAt = parseDate(formData.get("expiresAt"));
  if (!expiresAt) return { error: "Data de expirare este obligatorie." };

  try {
    await createDocument(
      { role: session.user.role, companyId: session.user.companyId },
      {
        vehicleId: (formData.get("vehicleId") as string) || undefined,
        driverId: (formData.get("driverId") as string) || undefined,
        type: formData.get("type") as DocumentType,
        number: (formData.get("number") as string) || null,
        issuedAt: parseDate(formData.get("issuedAt")),
        expiresAt,
        notes: (formData.get("notes") as string) || null,
      }
    );
  } catch (error) {
    if (error instanceof InvalidDocumentOwnerError) return { error: error.message };
    if (error instanceof TenantAccessError) {
      return { error: "Proprietarul documentului nu a fost găsit." };
    }
    throw error;
  }

  revalidatePath(ownerPath(formData));
  revalidatePath("/dashboard");
  return { error: null };
}

/**
 * Renewal is the only edit the spec calls for: a new ITP means a new expiry
 * date on the same document. It deliberately touches ONLY `expiresAt` — passing
 * the other fields would blank whatever the row form does not resubmit. A
 * document entered wrongly is deleted and re-added instead.
 */
export async function renewDocumentAction(
  documentId: string,
  ownerPathValue: string,
  _prevState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const expiresAt = parseDate(formData.get("expiresAt"));
  if (!expiresAt) return { error: "Data de expirare este obligatorie." };

  try {
    await updateDocument(
      { role: session.user.role, companyId: session.user.companyId },
      documentId,
      { expiresAt }
    );
  } catch (error) {
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof DocumentNotFoundError || error instanceof TenantAccessError) {
      return { error: new DocumentNotFoundError().message };
    }
    throw error;
  }

  revalidatePath(ownerPathValue);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteDocumentAction(documentId: string, ownerPathValue: string) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await deleteDocument(
      { role: session.user.role, companyId: session.user.companyId },
      documentId
    );
  } catch (error) {
    // A double-click or a row left over from someone else's delete hits this;
    // treat it the same as "already gone" instead of throwing to the error page.
    if (error instanceof DocumentNotFoundError || error instanceof TenantAccessError) {
      revalidatePath(ownerPathValue);
      revalidatePath("/dashboard");
      return;
    }
    throw error;
  }

  revalidatePath(ownerPathValue);
  revalidatePath("/dashboard");
}
