"use client";

import { type ChangeEvent, useActionState, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Trash2 } from "lucide-react";
import { saveCompanySettingsAction, type SettingsFormState } from "./actions";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CompanyValues = {
  name: string;
  logo: string | null;
  cui: string;
  regCom: string;
  shareCapital: string;
  address: string;
  city: string;
  county: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bankName: string;
  vatPayer: boolean;
  invoiceSeries: string;
};

export function CompanySettingsForm({
  t,
  values,
}: {
  t: Dictionary["settings"];
  values: CompanyValues;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    saveCompanySettingsAction,
    { error: null, saved: false }
  );
  const [vatPayer, setVatPayer] = useState(values.vatPayer);
  const [logo, setLogo] = useState<string | null>(values.logo);
  const fileRef = useRef<HTMLInputElement>(null);

  // Resize the picked image to a small square data URL, entirely in the
  // browser — no upload service needed, and the stored value stays tiny.
  function onPickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setLogo(canvas.toDataURL("image/webp", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  const initial = values.name.trim().charAt(0).toUpperCase() || "O";

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="logo" value={logo ?? ""} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionLogo}</h2>
        <div className="flex items-center gap-4">
          <span className="bg-muted grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-muted-foreground text-xl font-bold">{initial}</span>
            )}
          </span>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="mr-1.5 size-4" />
                {logo ? t.logoChange : t.logoUpload}
              </Button>
              {logo && (
                <Button type="button" variant="outline" size="sm" onClick={() => setLogo(null)}>
                  <Trash2 className="mr-1.5 size-4" />
                  {t.logoRemove}
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">{t.logoHint}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickLogo}
            className="hidden"
          />
        </div>
      </section>

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
            <Label htmlFor="shareCapital">{t.shareCapital}</Label>
            <Input id="shareCapital" name="shareCapital" defaultValue={values.shareCapital} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionAddress}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="space-y-1.5">
            <Label htmlFor="postalCode">{t.postalCode}</Label>
            <Input id="postalCode" name="postalCode" defaultValue={values.postalCode} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionContact}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t.phone}</Label>
            <Input id="phone" name="phone" defaultValue={values.phone} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t.email}</Label>
            <Input id="email" name="email" type="email" defaultValue={values.email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">{t.website}</Label>
            <Input id="website" name="website" defaultValue={values.website} />
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

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionInvoicing}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="invoiceSeries">{t.series}</Label>
            <Input id="invoiceSeries" name="invoiceSeries" defaultValue={values.invoiceSeries} />
            <p className="text-muted-foreground text-xs">{t.seriesHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-medium normal-case tracking-normal text-foreground">
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
