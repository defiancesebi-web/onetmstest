"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { inviteUserAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { InvitationRole } from "@/lib/generated/prisma/enums";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUserAction, { error: null });

  // Controlled: an already-invited address is a common rejection, and React 19
  // resets the form's DOM after every action call. A plain uncontrolled
  // <select> would then silently fall back to its first option, so a retried
  // submit could invite the colleague with the wrong role.
  const [role, setRole] = useState<InvitationRole>("COMPANY_USER");

  // React 19's post-action form reset touches the <select> DOM node directly,
  // which text inputs self-heal from but a <select> does not. Resync it
  // explicitly whenever the action settles — see vehicle-form.tsx for the
  // same pattern.
  const roleSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (roleSelectRef.current) roleSelectRef.current.value = role;
  }, [state, role]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input name="email" type="email" placeholder="Email coleg" required />
      <select
        ref={roleSelectRef}
        name="role"
        className="rounded border px-2 py-2 text-sm"
        value={role}
        onChange={(e) => setRole(e.target.value as InvitationRole)}
      >
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
