import { auth } from "@/auth";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen">
      <nav className="flex gap-4 border-b p-4">
        <Link href="/dashboard" className="font-semibold">
          ONE x TMS
        </Link>
        {session?.user.role === "COMPANY_ADMIN" && <Link href="/dashboard/echipa">Echipă</Link>}
      </nav>
      <main className="p-8">{children}</main>
    </div>
  );
}
