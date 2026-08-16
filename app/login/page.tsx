"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Autentificare</h1>
      <form action={formAction} className="space-y-4">
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Parolă" required />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se autentifică..." : "Intră în cont"}
        </Button>
      </form>
    </div>
  );
}
