"use client";

import { useActionState } from "react";
import { createExpenseAction, type ExpenseFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Option = { value: string; label: string };

export function ExpenseForm({
  t,
  categories,
  vehicles,
  drivers,
  today,
}: {
  t: Dictionary["expenses"];
  categories: Option[];
  vehicles: Option[];
  drivers: Option[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(
    createExpenseAction,
    { error: null }
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="date">{t.eDate}</Label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">{t.eCategory}</Label>
        <select id="category" name="category" className="w-full rounded-lg border px-2 py-2 text-sm">
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">{t.eAmount}</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vehicleId">{t.eVehicle}</Label>
        <select id="vehicleId" name="vehicleId" className="w-full rounded-lg border px-2 py-2 text-sm">
          <option value="">{t.eNone}</option>
          {vehicles.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="driverId">{t.eDriver}</Label>
        <select id="driverId" name="driverId" className="w-full rounded-lg border px-2 py-2 text-sm">
          <option value="">{t.eNone}</option>
          {drivers.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="liters">{t.eLiters}</Label>
        <Input id="liters" name="liters" type="number" step="0.01" min="0" />
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="notes">{t.eNotes}</Label>
        <Input id="notes" name="notes" />
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{state.error}</p>}

      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.eAdd}
        </Button>
      </div>
    </form>
  );
}
