"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VEHICLE_TYPE_LABELS } from "@/lib/documentStatus";
import type { VehicleType } from "@/lib/generated/prisma/enums";
import type { VehicleFormState } from "./actions";

type Values = {
  registrationNumber?: string;
  type?: VehicleType;
  make?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  vin?: string | null;
  notes?: string | null;
};

type Fields = {
  registrationNumber: string;
  type: VehicleType;
  make: string;
  model: string;
  manufactureYear: string;
  vin: string;
  notes: string;
};

function toFields(values?: Values): Fields {
  return {
    registrationNumber: values?.registrationNumber ?? "",
    type: values?.type ?? "TRACTOR_UNIT",
    make: values?.make ?? "",
    model: values?.model ?? "",
    // Kept as a string so clearing the field stays empty instead of becoming 0.
    manufactureYear: values?.manufactureYear ? String(values.manufactureYear) : "",
    vin: values?.vin ?? "",
    notes: values?.notes ?? "",
  };
}

export function VehicleForm({
  action,
  values,
  submitLabel,
}: {
  action: (state: VehicleFormState, formData: FormData) => Promise<VehicleFormState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  // Controlled: React 19 resets the form after every action call, which would
  // wipe the user's typing whenever the action returns an error.
  const [fields, setFields] = useState<Fields>(() => toFields(values));

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="registrationNumber">Număr de înmatriculare</Label>
        <Input
          id="registrationNumber"
          name="registrationNumber"
          value={fields.registrationNumber}
          onChange={(e) => update("registrationNumber", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">Tip</Label>
        <select
          id="type"
          name="type"
          value={fields.type}
          onChange={(e) => update("type", e.target.value as VehicleType)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map((type) => (
            <option key={type} value={type}>
              {VEHICLE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="make">Marcă</Label>
        <Input id="make" name="make" value={fields.make} onChange={(e) => update("make", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="model">Model</Label>
        <Input id="model" name="model" value={fields.model} onChange={(e) => update("model", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manufactureYear">An fabricație</Label>
        <Input
          id="manufactureYear"
          name="manufactureYear"
          type="number"
          min={1950}
          max={2100}
          value={fields.manufactureYear}
          onChange={(e) => update("manufactureYear", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vin">Serie șasiu</Label>
        <Input id="vin" name="vin" value={fields.vin} onChange={(e) => update("vin", e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Observații</Label>
        <Input id="notes" name="notes" value={fields.notes} onChange={(e) => update("notes", e.target.value)} />
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
