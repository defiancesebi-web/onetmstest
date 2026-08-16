"use client";

import { use, useActionState } from "react";
import { acceptInvitationAction } from "./actions";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const boundAction = acceptInvitationAction.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, { error: null });

  return (
    <AuthCard title="Finalizează contul">
      <form action={formAction} className="space-y-4">
        <Input name="name" placeholder="Numele tău" required />
        <Input name="password" type="password" placeholder="Alege o parolă" required minLength={8} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se creează contul..." : "Creează cont"}
        </Button>
      </form>
    </AuthCard>
  );
}
