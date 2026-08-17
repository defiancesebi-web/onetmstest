"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientFormState } from "./actions";

type Values = {
  name?: string;
  cui?: string;
  address?: string;
  city?: string;
  country?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  paymentTermDays?: number;
  notes?: string | null;
};

export function ClientForm({
  action,
  values,
  submitLabel,
}: {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    duplicateWarning: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume firmă</Label>
          <Input id="name" name="name" defaultValue={values?.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cui">CUI</Label>
          <Input id="cui" name="cui" defaultValue={values?.cui} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Adresă</Label>
          <Input id="address" name="address" defaultValue={values?.address} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Oraș</Label>
          <Input id="city" name="city" defaultValue={values?.city} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Țară</Label>
          <Input id="country" name="country" defaultValue={values?.country ?? "România"} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentTermDays">Termen de plată (zile)</Label>
          <Input
            id="paymentTermDays"
            name="paymentTermDays"
            type="number"
            min={0}
            defaultValue={values?.paymentTermDays ?? 45}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Persoană de contact</Label>
          <Input id="contactName" name="contactName" defaultValue={values?.contactName ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Telefon</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={values?.contactPhone ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Email</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={values?.contactEmail ?? ""}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Observații</Label>
          <Input id="notes" name="notes" defaultValue={values?.notes ?? ""} />
        </div>
      </div>

      {state.duplicateWarning && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{state.duplicateWarning}</p>
          {/* Resubmits the same fields with the confirmation flag set. */}
          <input type="hidden" name="confirmDuplicateCui" value="true" />
          <p className="text-xs">Apasă din nou pe buton pentru a-l adăuga oricum.</p>
        </div>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : submitLabel}
      </Button>
    </form>
  );
}
