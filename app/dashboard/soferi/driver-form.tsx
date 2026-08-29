"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import type { DriverFormState } from "./actions";

type Values = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  personalId?: string | null;
  hiredAt?: Date | null;
  notes?: string | null;
};

type Fields = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  personalId: string;
  hiredAt: string;
  notes: string;
};

function toFields(values?: Values): Fields {
  return {
    firstName: values?.firstName ?? "",
    lastName: values?.lastName ?? "",
    phone: values?.phone ?? "",
    email: values?.email ?? "",
    personalId: values?.personalId ?? "",
    hiredAt: values?.hiredAt ? values.hiredAt.toISOString().slice(0, 10) : "",
    notes: values?.notes ?? "",
  };
}

export function DriverForm({
  action,
  values,
  submitLabel,
  t,
}: {
  action: (state: DriverFormState, formData: FormData) => Promise<DriverFormState>;
  values?: Values;
  submitLabel: string;
  t: Dictionary["driverForm"];
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  // Controlled, for the same React 19 reset reason as every other form here.
  const [fields, setFields] = useState<Fields>(() => toFields(values));

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="lastName">{t.lastName}</Label>
        <Input
          id="lastName"
          name="lastName"
          value={fields.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="firstName">{t.firstName}</Label>
        <Input
          id="firstName"
          name="firstName"
          value={fields.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t.phone}</Label>
        <Input id="phone" name="phone" value={fields.phone} onChange={(e) => update("phone", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={fields.email}
          onChange={(e) => update("email", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hiredAt">{t.hiredAt}</Label>
        <DatePicker
          id="hiredAt"
          name="hiredAt"
          value={fields.hiredAt}
          onChange={(v) => update("hiredAt", v)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="personalId">{t.personalId}</Label>
        <Input
          id="personalId"
          name="personalId"
          value={fields.personalId}
          onChange={(e) => update("personalId", e.target.value)}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">{t.notes}</Label>
        <Input id="notes" name="notes" value={fields.notes} onChange={(e) => update("notes", e.target.value)} />
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : submitLabel}
        </Button>
      </div>
    </form>
  );
}
