"use client";

import { useActionState } from "react";
import { inviteUserAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUserAction, { error: null });

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input name="email" type="email" placeholder="Email coleg" required />
      <select name="role" className="rounded border px-2 py-2 text-sm" defaultValue="COMPANY_USER">
        <option value="COMPANY_USER">Utilizator</option>
        <option value="COMPANY_ADMIN">Admin firmă</option>
      </select>
      <Button type="submit" disabled={pending}>
        Invită
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
