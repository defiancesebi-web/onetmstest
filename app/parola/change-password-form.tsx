"use client";

import { useActionState, useEffect, useState } from "react";
import { changePasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, {
    error: null,
    changed: false,
  });
  // Controlled: a rejected submit must not wipe what was typed.
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    // Clearing only on success is deliberate — after a wrong current password
    // the person should not have to retype the new one they already chose.
    if (state.changed) {
      setCurrent("");
      setNext("");
      setConfirmation("");
    }
  }, [state]);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Parola actuală</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Parola nouă</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPasswordConfirmation">Repetă parola nouă</Label>
        <Input
          id="newPasswordConfirmation"
          name="newPasswordConfirmation"
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
          minLength={8}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.changed && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Parola a fost schimbată. Sesiunile deschise pe alte dispozitive rămân active.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : "Schimbă parola"}
      </Button>
    </form>
  );
}
