"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "./actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, { error: null });

  return (
    <AuthCard title="Înregistrează firma ta">
      <form action={formAction} className="space-y-4">
        <Input name="companyName" placeholder="Numele firmei" required />
        <Input name="cui" placeholder="CUI" required />
        <Input name="adminName" placeholder="Numele tău" required />
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Alege o parolă" required minLength={8} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se creează firma..." : "Creează cont"}
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        Ai deja cont?{" "}
        <Link href="/login" className="underline">
          Autentifică-te
        </Link>
      </p>
    </AuthCard>
  );
}
