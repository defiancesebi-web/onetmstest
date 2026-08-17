"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrderDetailsAction, type OrderFormState } from "../actions";

type Values = {
  clientReference: string;
  cargoDescription: string;
  cargoWeightKg: string | null;
  cargoPackaging: string | null;
  salePrice: string;
  currency: string;
  estimatedCostRon: string | null;
  paymentTermDays: number;
  notes: string | null;
};

type FormFields = {
  clientReference: string;
  cargoDescription: string;
  cargoWeightKg: string;
  cargoPackaging: string;
  salePrice: string;
  estimatedCostRon: string;
  paymentTermDays: number;
  notes: string;
};

function toFormFields(values: Values): FormFields {
  return {
    clientReference: values.clientReference,
    cargoDescription: values.cargoDescription,
    cargoWeightKg: values.cargoWeightKg ?? "",
    cargoPackaging: values.cargoPackaging ?? "",
    salePrice: values.salePrice,
    estimatedCostRon: values.estimatedCostRon ?? "",
    paymentTermDays: values.paymentTermDays,
    notes: values.notes ?? "",
  };
}

export function OrderEditForm({ orderId, values }: { orderId: string; values: Values }) {
  const boundAction = updateOrderDetailsAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(boundAction, {
    error: null,
    needsManualRate: false,
  });

  // Controlled state, not `defaultValue`: React resets uncontrolled form
  // fields to their initial value after every action submission, which would
  // wipe what the user typed the moment the action returns an error instead
  // of redirecting. Keeping the fields in state and always rendering
  // `value={fields.x}` means React's own reset can't win.
  const [fields, setFields] = useState<FormFields>(() => toFormFields(values));

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="clientReference">Referința clientului</Label>
        <Input
          id="clientReference"
          name="clientReference"
          value={fields.clientReference}
          onChange={(e) => update("clientReference", e.target.value)}
          required
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
          onChange={(e) => update("paymentTermDays", Number(e.target.value))}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cargoDescription">Descrierea mărfii</Label>
        <Input
          id="cargoDescription"
          name="cargoDescription"
          value={fields.cargoDescription}
          onChange={(e) => update("cargoDescription", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cargoWeightKg">Greutate (kg)</Label>
        <Input
          id="cargoWeightKg"
          name="cargoWeightKg"
          type="number"
          step="0.001"
          min="0"
          value={fields.cargoWeightKg}
          onChange={(e) => update("cargoWeightKg", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cargoPackaging">Ambalaj</Label>
        <Input
          id="cargoPackaging"
          name="cargoPackaging"
          value={fields.cargoPackaging}
          onChange={(e) => update("cargoPackaging", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="salePrice">Preț de vânzare ({values.currency})</Label>
        <Input
          id="salePrice"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          value={fields.salePrice}
          onChange={(e) => update("salePrice", e.target.value)}
          required
        />
        {/* The stored rate is reused on save; the currency itself is not editable. */}
        <p className="text-muted-foreground text-xs">
          Echivalentul în RON se recalculează cu cursul înghețat la crearea comenzii.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estimatedCostRon">Cost estimat (RON)</Label>
        <Input
          id="estimatedCostRon"
          name="estimatedCostRon"
          type="number"
          step="0.01"
          min="0"
          value={fields.estimatedCostRon}
          onChange={(e) => update("estimatedCostRon", e.target.value)}
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

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : "Salvează modificările"}
        </Button>
      </div>
    </form>
  );
}
