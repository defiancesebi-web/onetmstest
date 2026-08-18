"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestPasswordResetAction } from "./actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, {
    error: null,
    sent: false,
  });
  // Controlled: React resets the form after every action call, which would wipe
  // the address the moment anything comes back.
  const [email, setEmail] = useState("");

  return (
    <AuthCard title="Mi-am uitat parola">
      {state.sent ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Dacă adresa introdusă are un cont, ți-am trimis un link de resetare. Verifică-ți
          emailul, inclusiv folderul Spam. Linkul este valabil o oră.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Introdu adresa de email a contului tău și îți trimitem un link pentru a-ți seta o
            parolă nouă.
          </p>
          <form action={formAction} className="space-y-4">
            <Input
              name="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Se trimite..." : "Trimite linkul"}
            </Button>
          </form>
        </>
      )}

      <p className="text-muted-foreground text-sm">
        <Link href="/login" className="underline">
          Înapoi la autentificare
        </Link>
      </p>
    </AuthCard>
  );
}
