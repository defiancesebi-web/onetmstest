"use client";

import { useActionState } from "react";
import { registerAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, { error: null });

  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Înregistrează firma ta</h1>
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
    </div>
  );
}
