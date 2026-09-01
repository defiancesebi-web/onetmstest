"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { updateMyProfile } from "@/lib/data/users";

export type ProfileState = { error: string | null; saved: boolean };

export async function saveProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Neautentificat", saved: false };

  const avatarRaw = ((formData.get("avatar") as string | null) ?? "").trim();
  let avatar: string | null = null;
  if (avatarRaw) {
    if (!avatarRaw.startsWith("data:image/")) return { error: "Poză invalidă.", saved: false };
    if (avatarRaw.length > 400_000) return { error: "Poza este prea mare.", saved: false };
    avatar = avatarRaw;
  }

  try {
    await updateMyProfile(session.user.id, {
      name: ((formData.get("name") as string) || "").trim(),
      phone: ((formData.get("phone") as string) || "").trim() || null,
      avatar,
    });
  } catch (e) {
    return { error: (e as Error).message, saved: false };
  }

  revalidatePath("/dashboard/profil");
  // The top bar shows the avatar/name, so refresh the layout too.
  revalidatePath("/dashboard", "layout");
  return { error: null, saved: true };
}
