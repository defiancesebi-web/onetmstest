"use server";

import { auth } from "@/auth";
import { createInvitation, InvalidInvitationError } from "@/lib/data/invitations";
import { sendInviteEmail } from "@/lib/email/sendInvite";
import { getCompanyForSession } from "@/lib/data/companies";
import { revalidatePath } from "next/cache";
import type { InvitationRole } from "@/lib/generated/prisma/enums";

export async function inviteUserAction(_prevState: { error: string | null }, formData: FormData) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const email = formData.get("email") as string;
  const role = formData.get("role") as InvitationRole;
  const sessionUser = { role: session.user.role, companyId: session.user.companyId };

  try {
    const company = await getCompanyForSession(sessionUser);
    const invitation = await createInvitation(sessionUser, {
      companyId: session.user.companyId,
      email,
      role,
    });
    await sendInviteEmail(email, company?.name ?? "firma ta", invitation.token);
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/dashboard/echipa");
  return { error: null };
}
