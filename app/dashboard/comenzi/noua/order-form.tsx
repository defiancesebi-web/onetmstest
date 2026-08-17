"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrderAction, type OrderFormState } from "../actions";

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
}: {
  clients: { id: string; name: string; paymentTermDays: number }[];
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
  const [paymentTermDays, setPaymentTermDays] = useState(clients[0]?.paymentTermDays ?? 45);
  const [manualExchangeRate, setManualExchangeRate] = useState("");
  const [notes, setNotes] = useState("");

  function updateStop(index: number, patch: Partial<Stop>) {
    setStops((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      {/* Stops live in React state; this hidden field is how they reach the server. */}
      <input type="hidden" name="stops" value={JSON.stringify(stops)} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Client și marfă</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client</Label>
            <select
              id="clientId"
              name="clientId"
              required
              value={clientId}
              className="w-full rounded-lg border px-2 py-2 text-sm"
              onChange={(e) => {
                setClientId(e.target.value);
                const client = clients.find((c) => c.id === e.target.value);
                if (client) setPaymentTermDays(client.paymentTermDays);
              }}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientReference">Referința clientului</Label>
            <Input
              id="clientReference"
              name="clientReference"
              required
              value={clientReference}
              onChange={(e) => setClientReference(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cargoDescription">Descrierea mărfii</Label>
            <Input
              id="cargoDescription"
              name="cargoDescription"
              required
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
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
              value={cargoWeightKg}
              onChange={(e) => setCargoWeightKg(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargoPackaging">Ambalaj</Label>
            <Input
              id="cargoPackaging"
              name="cargoPackaging"
              placeholder="paleți, vrac..."
              value={cargoPackaging}
              onChange={(e) => setCargoPackaging(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Opriri</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStops((c) => [...c, emptyStop("LOADING")])}
            >
              + Încărcare
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStops((c) => [...c, emptyStop("UNLOADING")])}
            >
              + Descărcare
            </Button>
          </div>
        </div>

        {stops.map((stop, index) => (
          <div key={index} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {index + 1}. {stop.type === "LOADING" ? "Încărcare" : "Descărcare"}
              </span>
              {stops.length > 2 && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setStops((c) => c.filter((_, i) => i !== index))}
                >
                  Șterge
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Adresă"
                required
                value={stop.address}
                onChange={(e) => updateStop(index, { address: e.target.value })}
              />
              <Input
                placeholder="Oraș"
                required
                value={stop.city}
                onChange={(e) => updateStop(index, { city: e.target.value })}
              />
              <Input
                type="date"
                required
                value={stop.scheduledDate}
                onChange={(e) => updateStop(index, { scheduledDate: e.target.value })}
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
                placeholder="Persoană de contact"
                value={stop.contactName}
                onChange={(e) => updateStop(index, { contactName: e.target.value })}
              />
              <Input
                placeholder="Telefon"
                value={stop.contactPhone}
                onChange={(e) => updateStop(index, { contactPhone: e.target.value })}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Bani</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salePrice">Preț de vânzare</Label>
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
            <Label htmlFor="currency">Valută</Label>
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
          <div className="space-y-1.5">
            <Label htmlFor="estimatedCostRon">Cost estimat (RON)</Label>
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
            <Label htmlFor="paymentTermDays">Termen de plată (zile)</Label>
            <Input
              id="paymentTermDays"
              name="paymentTermDays"
              type="number"
              min={0}
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(Number(e.target.value))}
            />
          </div>
          {state.needsManualRate && currency === "EUR" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="manualExchangeRate">Curs EUR → RON (manual)</Label>
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
            </div>
          )}
        </div>
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observații</Label>
        <Input id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : "Salvează comanda"}
      </Button>
    </form>
  );
}
