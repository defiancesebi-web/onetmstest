import Link from "next/link";
import { ChevronLeft, KeyRound } from "lucide-react";
import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground hover:bg-muted mb-4 inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
        >
          <ChevronLeft className="size-4" />
          Înapoi la aplicație
        </Link>

        <div className="bg-card rounded-2xl border p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="bg-primary/10 text-primary mb-3 grid size-12 place-items-center rounded-full">
              <KeyRound className="size-6" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">Schimbă parola</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Ai nevoie de parola actuală pentru a o schimba.
            </p>
          </div>

          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
