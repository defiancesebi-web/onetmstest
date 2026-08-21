"use client";

import { useActionState, useState } from "react";
import { createFixedCostAction, type ExpenseFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Option = { value: string; label: string };

export function FixedCostForm({
  t,
  categories,
  periods,
  vehicles,
}: {
  t: Dictionary["expenses"];
  categories: Option[];
  periods: Option[];
  vehicles: Option[];
}) {
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(
    createFixedCostAction,
    { error: null }
  );
  const [currency, setCurrency] = useState("RON");

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="label">{t.fLabel}</Label>
        <Input id="label" name="label" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">{t.fAmount}</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">{t.currency}</Label>
        <select
          id="currency"
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="RON">RON</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      {currency === "EUR" && (
        <div className="space-y-1.5">
          <Label htmlFor="exchangeRate">{t.rate}</Label>
          <Input id="exchangeRate" name="exchangeRate" type="number" step="0.0001" min="0" required />
          <p className="text-muted-foreground text-xs">{t.rateHint}</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="category">{t.fCategory}</Label>
        <select id="category" name="category" className="w-full rounded-lg border px-2 py-2 text-sm">
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="period">{t.fPeriod}</Label>
        <select id="period" name="period" className="w-full rounded-lg border px-2 py-2 text-sm">
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vehicleId">{t.fVehicle}</Label>
        <select id="vehicleId" name="vehicleId" className="w-full rounded-lg border px-2 py-2 text-sm">
          <option value="">{t.generalOption}</option>
          {vehicles.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="notes">{t.fNotes}</Label>
        <Input id="notes" name="notes" />
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{state.error}</p>}

      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.fAdd}
        </Button>
      </div>
    </form>
  );
}
