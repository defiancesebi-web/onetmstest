import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getMyProfile } from "@/lib/data/users";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();
  const dict = await getDictionary();
  const t = dict.profile;

  const me = session?.user?.id ? await getMyProfile(session.user.id) : null;
  if (!me) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t.title} description={t.subtitle} />
      <ProfileForm
        values={{ name: me.name, phone: me.phone ?? "", avatar: me.avatar }}
        email={me.email}
        jobTitle={me.jobTitle}
        t={t}
      />
    </div>
  );
}
