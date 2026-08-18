"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <AuthCard title="Autentificare">
      <form action={formAction} className="space-y-4">
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Parolă" required />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se autentifică..." : "Intră în cont"}
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        <Link href="/parola-uitata" className="underline">
          Mi-am uitat parola
        </Link>
      </p>
      <p className="text-muted-foreground text-sm">
        Nu ai cont?{" "}
        <Link href="/inregistrare" className="underline">
          Înregistrează-ți firma
        </Link>
      </p>
    </AuthCard>
  );
}
