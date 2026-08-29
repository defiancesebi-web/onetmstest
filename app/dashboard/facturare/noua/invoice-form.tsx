"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { createInvoiceAction, type InvoiceFormState } from "../actions";
import { INVOICE_UNITS } from "@/lib/invoice-constants";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";

export type ClientOption = {
  id: string;
  name: string;
  cui: string;
  address: string;
  city: string;
  country: string;
  paymentTermDays: number;
};

export type InvoicePrefill = {
  orderId: string;
  orderNumber: string;
  clientId: string;
  currency: "RON" | "EUR";
  exchangeRate: string;
  dueDate: string;
  line: { description: string; unitPrice: string };
};

type Line = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function InvoiceForm({
  t,
  locale,
  clients,
  vatPayer,
  defaultVat,
  today,
  defaultDue,
  prefill,
}: {
  t: Dictionary["invoiceForm"];
  locale: Locale;
  clients: ClientOption[];
  vatPayer: boolean;
  defaultVat: string;
  today: string;
  defaultDue: string;
  prefill: InvoicePrefill | null;
}) {
  const [state, formAction, pending] = useActionState<InvoiceFormState, FormData>(
    createInvoiceAction,
    { error: null }
  );

  const prefilledClient = prefill ? clients.find((c) => c.id === prefill.clientId) ?? null : null;

  const [clientId, setClientId] = useState(prefill?.clientId ?? "");
  const [buyer, setBuyer] = useState({
    name: prefilledClient?.name ?? "",
    cui: prefilledClient?.cui ?? "",
    regCom: "",
    address: prefilledClient?.address ?? "",
    city: prefilledClient?.city ?? "",
    county: "",
    country: prefilledClient?.country ?? "România",
  });
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(prefill?.dueDate ?? defaultDue);
  const [currency, setCurrency] = useState<"RON" | "EUR">(prefill?.currency ?? "RON");
  const [exchangeRate, setExchangeRate] = useState(prefill?.exchangeRate ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      description: prefill?.line.description ?? "",
      unit: "cursă",
      quantity: "1",
      unitPrice: prefill?.line.unitPrice ?? "",
      vatRate: defaultVat,
    },
  ]);

  function selectClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) {
      setBuyer((prev) => ({
        ...prev,
        name: c.name,
        cui: c.cui,
        address: c.address,
        city: c.city,
        country: c.country,
      }));
    }
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const totals = useMemo(() => {
    let net = 0;
    let vat = 0;
    for (const l of lines) {
      const q = Number(l.quantity);
      const p = Number(l.unitPrice);
      if (!isFinite(q) || !isFinite(p)) continue;
      const lineNet = round2(q * p);
      net += lineNet;
      if (vatPayer) {
        const r = Number(l.vatRate);
        if (isFinite(r)) vat += round2((lineNet * r) / 100);
      }
    }
    net = round2(net);
    vat = round2(vat);
    return { net, vat, gross: round2(net + vat) };
  }, [lines, vatPayer]);

  const money = (n: number) =>
    new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  const lineNet = (l: Line) => {
    const q = Number(l.quantity);
    const p = Number(l.unitPrice);
    return isFinite(q) && isFinite(p) ? money(round2(q * p)) : "—";
  };

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="clientId" value={clientId} />
      {prefill && <input type="hidden" name="orderId" value={prefill.orderId} />}

      {/* Buyer */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionBuyer}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="clientPick">{t.useClient}</Label>
          <select
            id="clientPick"
            value={clientId}
            onChange={(e) => selectClient(e.target.value)}
            className="w-full max-w-sm select-native"
          >
            <option value="">{t.chooseClient}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="buyerName">{t.buyerName}</Label>
            <Input
              id="buyerName"
              name="buyerName"
              required
              value={buyer.name}
              onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerCui">{t.buyerCui}</Label>
            <Input
              id="buyerCui"
              name="buyerCui"
              required
              value={buyer.cui}
              onChange={(e) => setBuyer({ ...buyer, cui: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerRegCom">{t.buyerRegCom}</Label>
            <Input
              id="buyerRegCom"
              name="buyerRegCom"
              value={buyer.regCom}
              onChange={(e) => setBuyer({ ...buyer, regCom: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerCountry">{t.buyerCountry}</Label>
            <Input
              id="buyerCountry"
              name="buyerCountry"
              value={buyer.country}
              onChange={(e) => setBuyer({ ...buyer, country: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="buyerAddress">{t.buyerAddress}</Label>
            <Input
              id="buyerAddress"
              name="buyerAddress"
              value={buyer.address}
              onChange={(e) => setBuyer({ ...buyer, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerCity">{t.buyerCity}</Label>
            <Input
              id="buyerCity"
              name="buyerCity"
              value={buyer.city}
              onChange={(e) => setBuyer({ ...buyer, city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerCounty">{t.buyerCounty}</Label>
            <Input
              id="buyerCounty"
              name="buyerCounty"
              value={buyer.county}
              onChange={(e) => setBuyer({ ...buyer, county: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Dates & currency */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">{t.sectionDates}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="issueDate">{t.issueDate}</Label>
            <DatePicker
              id="issueDate"
              name="issueDate"
              value={issueDate}
              onChange={(v) => setIssueDate(v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">{t.dueDate}</Label>
            <DatePicker
              id="dueDate"
              name="dueDate"
              value={dueDate}
              onChange={(v) => setDueDate(v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">{t.currency}</Label>
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "RON" | "EUR")}
              className="w-full select-native"
            >
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          {currency === "EUR" && (
            <div className="space-y-1.5">
              <Label htmlFor="exchangeRate">{t.exchangeRate}</Label>
              <Input
                id="exchangeRate"
                name="exchangeRate"
                type="number"
                step="0.0001"
                min="0"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </div>
          )}
        </div>
        {currency === "EUR" && <p className="text-muted-foreground text-xs">{t.exchangeRateHint}</p>}
      </section>

      {/* Lines */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t.sectionLines}</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setLines((c) => [
                ...c,
                { description: "", unit: "buc", quantity: "1", unitPrice: "", vatRate: defaultVat },
              ])
            }
          >
            {t.addLine}
          </Button>
        </div>

        {!vatPayer && <p className="text-muted-foreground text-xs">{t.nonVatNote}</p>}

        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-12">
                <div className="sm:col-span-12">
                  <Input
                    placeholder={t.lineDescription}
                    required
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <select
                    aria-label={t.lineUnit}
                    value={line.unit}
                    onChange={(e) => updateLine(i, { unit: e.target.value })}
                    className="w-full select-native"
                  >
                    {INVOICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Input
                    aria-label={t.lineQty}
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder={t.lineQty}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    aria-label={t.lineUnitPrice}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t.lineUnitPrice}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                  />
                </div>
                {vatPayer && (
                  <div className="sm:col-span-2">
                    <Input
                      aria-label={t.lineVat}
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder={t.lineVat}
                      value={line.vatRate}
                      onChange={(e) => updateLine(i, { vatRate: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between sm:col-span-3 sm:justify-end sm:gap-3">
                  <span className="text-sm font-medium tabular-nums">{lineNet(line)}</span>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setLines((c) => c.filter((_, idx) => idx !== i))}
                      aria-label={t.removeLine}
                    >
                      <Trash2 className="size-4 text-rose-500" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Totals */}
      <div className="flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.totalNet}</dt>
            <dd className="tabular-nums">{money(totals.net)}</dd>
          </div>
          {vatPayer && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t.totalVat}</dt>
              <dd className="tabular-nums">{money(totals.vat)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-1.5 text-base font-bold">
            <dt>{t.totalGross}</dt>
            <dd className="tabular-nums">{money(totals.gross)}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Input id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
          {pending ? t.saving : t.saveDraft}
        </Button>
        <Button type="submit" name="intent" value="issue" disabled={pending}>
          {pending ? t.saving : t.issueNow}
        </Button>
      </div>
    </form>
  );
}
