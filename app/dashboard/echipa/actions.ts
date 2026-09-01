"use server";

import { auth } from "@/auth";
import { createInvitation, InvalidInvitationError } from "@/lib/data/invitations";
import { sendInviteEmail, InviteEmailError } from "@/lib/email/sendInvite";
import { getCompanyForSession } from "@/lib/data/companies";
import { setMemberJobTitle, ForbiddenError } from "@/lib/data/users";
import { revalidatePath } from "next/cache";
import type { InvitationRole } from "@/lib/generated/prisma/enums";

export type JobTitleState = { error: string | null; saved: boolean };

/** Owner-only: set a team member's function/title. */
export async function setMemberJobTitleAction(
  userId: string,
  _prev: JobTitleState,
  formData: FormData
): Promise<JobTitleState> {
  const session = await auth();
  if (!session?.user.companyId) return { error: "Neautentificat", saved: false };
  try {
    await setMemberJobTitle(
      { role: session.user.role, companyId: session.user.companyId },
      userId,
      (formData.get("jobTitle") as string) || null
    );
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message, saved: false };
    throw error;
  }
  revalidatePath("/dashboard/echipa");
  revalidatePath("/dashboard", "layout");
  return { error: null, saved: true };
}

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
    if (error instanceof InviteEmailError) {
      // The invitation row exists and its link stays valid; only delivery failed.
      revalidatePath("/dashboard/echipa");
      return {
        error: `Invitația a fost creată, dar emailul nu a putut fi trimis (${error.message}). Trimite-i manual linkul de invitație.`,
      };
    }
    throw error;
  }

  revalidatePath("/dashboard/echipa");
  return { error: null };
}
