"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { saveInvoicingSettingsAction, type SettingsFormState } from "../actions";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Values = {
  name: string;
  cui: string;
  regCom: string;
  address: string;
  city: string;
  county: string;
  postalCode: string;
  iban: string;
  bankName: string;
  vatPayer: boolean;
  invoiceSeries: string;
};

export function InvoicingSettingsForm({
  t,
  values,
}: {
  t: Dictionary["invoiceSettings"];
  values: Values;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    saveInvoicingSettingsAction,
    { error: null, saved: false }
  );
  const [vatPayer, setVatPayer] = useState(values.vatPayer);

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionIdentity}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.name}</Label>
            <Input value={values.name} disabled />
            <p className="text-muted-foreground text-xs">{t.readonlyHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t.cui}</Label>
            <Input value={values.cui} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regCom">{t.regCom}</Label>
            <Input id="regCom" name="regCom" defaultValue={values.regCom} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postalCode">{t.postalCode}</Label>
            <Input id="postalCode" name="postalCode" defaultValue={values.postalCode} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">{t.address}</Label>
            <Input id="address" name="address" defaultValue={values.address} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">{t.city}</Label>
            <Input id="city" name="city" defaultValue={values.city} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="county">{t.county}</Label>
            <Input id="county" name="county" defaultValue={values.county} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionInvoicing}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="invoiceSeries">{t.series}</Label>
            <Input id="invoiceSeries" name="invoiceSeries" defaultValue={values.invoiceSeries} />
            <p className="text-muted-foreground text-xs">{t.seriesHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="vatPayer"
                checked={vatPayer}
                onChange={(e) => setVatPayer(e.target.checked)}
                className="size-4"
              />
              {t.vatPayer}
            </Label>
            <p className="text-muted-foreground text-xs">{t.vatPayerHint}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionBank}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="iban">{t.iban}</Label>
            <Input id="iban" name="iban" defaultValue={values.iban} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bankName">{t.bankName}</Label>
            <Input id="bankName" name="bankName" defaultValue={values.bankName} />
          </div>
        </div>
      </section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && (
        <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" /> {t.saved}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}
