"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { createOrderAction, type OrderFormState } from "../actions";
import { stopTypeLabel } from "@/lib/labels";
import type { Locale, Dictionary } from "@/lib/i18n";
import { multiplyAndRoundToTwoDecimals } from "@/lib/money";

function formatRateDate(isoDate: string, locale: Locale): string {
  // isoDate is a bare "YYYY-MM-DD" with no time component, so it must be
  // read back in UTC — otherwise a browser west of Bucharest would parse
  // midnight UTC as the previous day's evening and display the wrong date.
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

type Stop = {
  type: "LOADING" | "UNLOADING";
  address: string;
  city: string;
  scheduledDate: string;
  timeFrom: string;
  timeTo: string;
  contactName: string;
  contactPhone: string;
};

function emptyStop(type: Stop["type"]): Stop {
  return {
    type,
    address: "",
    city: "",
    scheduledDate: "",
    timeFrom: "",
    timeTo: "",
    contactName: "",
    contactPhone: "",
  };
}

export function OrderForm({
  clients,
  eurRate,
  t,
  locale,
}: {
  clients: { id: string; name: string; paymentTermDays: number }[];
  /** Fetched server-side on page load; null means BNR was unreachable. */
  eurRate: { rate: string; date: string } | null;
  t: Dictionary["orderForm"];
  locale: Locale;
}) {
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(
    createOrderAction,
    { error: null, needsManualRate: false }
  );

  const [stops, setStops] = useState<Stop[]>([emptyStop("LOADING"), emptyStop("UNLOADING")]);

  // Every scalar field below is controlled by React state — not just the
  // stops list — so that a failed submit (e.g. the "must have an unloading
  // stop" validation error) only ever costs the user the missing piece, not
  // everything else they already typed. React 19 resets a `<form action>`'s
  // native fields after every action call; a plain uncontrolled <input>
  // would lose its value on that reset even though the DOM node survives.
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [clientReference, setClientReference] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [cargoWeightKg, setCargoWeightKg] = useState("");
  const [cargoPackaging, setCargoPackaging] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [currency, setCurrency] = useState("RON");
  const [estimatedCostRon, setEstimatedCostRon] = useState("");
  // Kept as a string, not a number: `Number("")` is 0, so an intermediate
  // Number() conversion on every keystroke would collapse a field the user
  // just cleared (to retype it) into 0 before they finish typing — silently
  // writing a 0-day payment term. Staying a string lets the field go empty;
  // the server's `Number(formData.get("paymentTermDays") || 45)` treats an
  // empty submission as "use the default", not as zero.
  const [paymentTermDays, setPaymentTermDays] = useState(
    String(clients[0]?.paymentTermDays ?? 45)
  );
  const [manualExchangeRate, setManualExchangeRate] = useState("");
  const [notes, setNotes] = useState("");

  // React 19's post-action form reset touches <select> DOM nodes directly.
  // Text inputs self-heal via their internal value tracker, but a <select>
  // does not, so a rejected submit (e.g. "must have an unloading stop", or
  // BNR being unreachable) can leave a dropdown showing its first option even
  // though the corresponding state is still correct. Resync both explicitly
  // whenever the action settles — see vehicle-form.tsx / documents-section.tsx
  // for the same pattern, and the currency case for why it matters: a stale
  // RON selection here would silently persist the wrong money.
  // The client picker is a Combobox (renders from `value`), so only the native
  // currency <select> still needs its DOM value forced back after a re-render.
  const currencySelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (currencySelectRef.current) currencySelectRef.current.value = currency;
  }, [state, currency]);

  // BNR unreachable at page load → ask for a manual rate right away, not
  // only after a failed submit. A failed submit (e.g. the cached rate
  // expired between page load and save) can still flip this on via
  // state.needsManualRate.
  const showManualRateField = currency === "EUR" && (eurRate === null || state.needsManualRate);
  const effectiveRate = manualExchangeRate || eurRate?.rate;
  const ronPreview =
    currency === "EUR" && salePrice && effectiveRate
      ? multiplyAndRoundToTwoDecimals(salePrice, effectiveRate)
      : null;

  function updateStop(index: number, patch: Partial<Stop>) {
    setStops((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <form action={formAction} className="w-full space-y-8 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      {/* Stops live in React state; this hidden field is how they reach the server. */}
      <input type="hidden" name="stops" value={JSON.stringify(stops)} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionClientCargo}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="clientId">{t.client}</Label>
            <Combobox
              id="clientId"
              name="clientId"
              value={clientId}
              onChange={(v) => {
                setClientId(v);
                const client = clients.find((c) => c.id === v);
                if (client) setPaymentTermDays(String(client.paymentTermDays));
              }}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder={t.client}
              showAvatars
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientReference">{t.clientReference}</Label>
            <Input
              id="clientReference"
              name="clientReference"
              required
              value={clientReference}
              onChange={(e) => setClientReference(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cargoDescription">{t.cargoDescription}</Label>
            <Input
              id="cargoDescription"
              name="cargoDescription"
              required
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargoWeightKg">{t.weightKg}</Label>
            <Input
              id="cargoWeightKg"
              name="cargoWeightKg"
              type="number"
              step="0.001"
              min="0"
              value={cargoWeightKg}
              onChange={(e) => setCargoWeightKg(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargoPackaging">{t.packaging}</Label>
            <Input
              id="cargoPackaging"
              name="cargoPackaging"
              placeholder={t.packagingPlaceholder}
              value={cargoPackaging}
              onChange={(e) => setCargoPackaging(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t.sectionStops}</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStops((c) => [...c, emptyStop("LOADING")])}
            >
              {t.addLoading}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStops((c) => [...c, emptyStop("UNLOADING")])}
            >
              {t.addUnloading}
            </Button>
          </div>
        </div>

        {stops.map((stop, index) => (
          <div key={index} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {index + 1}. {stopTypeLabel(stop.type, locale)}
              </span>
              {stops.length > 2 && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setStops((c) => c.filter((_, i) => i !== index))}
                >
                  {t.delete}
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder={t.address}
                required
                value={stop.address}
                onChange={(e) => updateStop(index, { address: e.target.value })}
              />
              <Input
                placeholder={t.city}
                required
                value={stop.city}
                onChange={(e) => updateStop(index, { city: e.target.value })}
              />
              <DatePicker
                value={stop.scheduledDate}
                onChange={(v) => updateStop(index, { scheduledDate: v })}
              />
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={stop.timeFrom}
                  onChange={(e) => updateStop(index, { timeFrom: e.target.value })}
                />
                <Input
                  type="time"
                  value={stop.timeTo}
                  onChange={(e) => updateStop(index, { timeTo: e.target.value })}
                />
              </div>
              <Input
                placeholder={t.contactName}
                value={stop.contactName}
                onChange={(e) => updateStop(index, { contactName: e.target.value })}
              />
              <Input
                placeholder={t.phone}
                value={stop.contactPhone}
                onChange={(e) => updateStop(index, { contactPhone: e.target.value })}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionMoney}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salePrice">{t.salePrice}</Label>
            <Input
              id="salePrice"
              name="salePrice"
              type="number"
              step="0.01"
              min="0"
              required
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">{t.currency}</Label>
            <select
              ref={currencySelectRef}
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full select-native"
            >
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimatedCostRon">{t.estimatedCost}</Label>
            <Input
              id="estimatedCostRon"
              name="estimatedCostRon"
              type="number"
              step="0.01"
              min="0"
              value={estimatedCostRon}
              onChange={(e) => setEstimatedCostRon(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paymentTermDays">{t.paymentTermDays}</Label>
            <Input
              id="paymentTermDays"
              name="paymentTermDays"
              type="number"
              min={0}
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(e.target.value)}
            />
          </div>
          {showManualRateField && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="manualExchangeRate">{t.manualRate}</Label>
              <Input
                id="manualExchangeRate"
                name="manualExchangeRate"
                type="number"
                step="0.0001"
                min="0"
                required
                value={manualExchangeRate}
                onChange={(e) => setManualExchangeRate(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">{t.manualRateHint}</p>
            </div>
          )}
          {currency === "EUR" && (
            <div className="text-muted-foreground space-y-1 text-xs sm:col-span-2">
              {!showManualRateField && eurRate && (
                <p>
                  {t.bnrRate}: {eurRate.rate} RON {t.bnrRateFrom}{" "}
                  {formatRateDate(eurRate.date, locale)}
                </p>
              )}
              {ronPreview && (
                <p>
                  {t.ronEquivalent}: {ronPreview} RON
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Input id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}
