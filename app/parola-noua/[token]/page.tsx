"use client";

import Link from "next/link";
import { use, useActionState, useState } from "react";
import { resetPasswordAction } from "./actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const boundAction = resetPasswordAction.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, { error: null });
  // Controlled: a rejected submit must not wipe what was typed.
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <AuthCard title="Setează o parolă nouă">
      <form action={formAction} className="space-y-4">
        <Input
          name="password"
          type="password"
          placeholder="Parolă nouă"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <Input
          name="passwordConfirmation"
          type="password"
          placeholder="Repetă parola nouă"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
          minLength={8}
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se salvează..." : "Salvează parola"}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        <Link href="/parola-uitata" className="underline">
          Cere un link nou
        </Link>
      </p>
    </AuthCard>
  );
}
