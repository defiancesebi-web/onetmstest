import { redirect } from "next/navigation";
import { auth } from "@/auth";

// The bare root just routes people into the app instead of showing a landing
// page: signed-out visitors go to login, company users to their dashboard, and
// the platform owner to the admin area. (Replaces the create-next-app starter.)
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
}
