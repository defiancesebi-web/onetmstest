"use client";

import { useActionState, useState } from "react";
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

type FormFields = {
  name: string;
  cui: string;
  address: string;
  city: string;
  country: string;
  // Kept as a string, not a number: `Number("")` is 0, so an intermediate
  // Number() conversion on every keystroke would collapse a field the user
  // just cleared (to retype it) into 0 before they finish typing — silently
  // writing a 0-day payment term. Staying a string lets the field go empty;
  // the server's `Number(formData.get("paymentTermDays") || 45)` treats an
  // empty submission as "use the default", not as zero.
  paymentTermDays: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
};

function toFormFields(values?: Values): FormFields {
  return {
    name: values?.name ?? "",
    cui: values?.cui ?? "",
    address: values?.address ?? "",
    city: values?.city ?? "",
    country: values?.country ?? "România",
    paymentTermDays: String(values?.paymentTermDays ?? 45),
    contactName: values?.contactName ?? "",
    contactPhone: values?.contactPhone ?? "",
    contactEmail: values?.contactEmail ?? "",
    notes: values?.notes ?? "",
  };
}

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
  // Controlled state, not `defaultValue`: React resets uncontrolled form
  // fields to their initial value after every action submission (even one
  // that just re-renders a warning), which would wipe what the user typed
  // right when the duplicate-CUI flow asks them to submit again. Keeping
  // the fields in state and always rendering `value={fields.x}` means
  // React's own reset can't win — the next render reapplies our state.
  const [fields, setFields] = useState<FormFields>(() => toFormFields(values));

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume firmă</Label>
          <Input
            id="name"
            name="name"
            value={fields.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cui">CUI</Label>
          <Input
            id="cui"
            name="cui"
            value={fields.cui}
            onChange={(e) => update("cui", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Adresă</Label>
          <Input
            id="address"
            name="address"
            value={fields.address}
            onChange={(e) => update("address", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Oraș</Label>
          <Input
            id="city"
            name="city"
            value={fields.city}
            onChange={(e) => update("city", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Țară</Label>
          <Input
            id="country"
            name="country"
            value={fields.country}
            onChange={(e) => update("country", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentTermDays">Termen de plată (zile)</Label>
          <Input
            id="paymentTermDays"
            name="paymentTermDays"
            type="number"
            min={0}
            value={fields.paymentTermDays}
            onChange={(e) => update("paymentTermDays", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Persoană de contact</Label>
          <Input
            id="contactName"
            name="contactName"
            value={fields.contactName}
            onChange={(e) => update("contactName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Telefon</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            value={fields.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Email</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={fields.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Observații</Label>
          <Input
            id="notes"
            name="notes"
            value={fields.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
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
