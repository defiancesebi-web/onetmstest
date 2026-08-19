"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTripAction, type TripFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ResourceOption = { id: string; label: string };

export function NewTripForm({
  tractorUnits,
  trailers,
  drivers,
  orderId,
  defaultStartsAt,
  defaultEndsAt,
}: {
  tractorUnits: ResourceOption[];
  trailers: ResourceOption[];
  drivers: ResourceOption[];
  orderId?: string;
  defaultStartsAt: string;
  defaultEndsAt: string;
}) {
  const [state, formAction, pending] = useActionState<TripFormState, FormData>(createTripAction, {
    error: null,
    conflicts: [],
  });

  // Controlled: React 19 resets the form after every action call, which would
  // wipe everything the moment a conflict warning comes back.
  const [fields, setFields] = useState({
    startsAt: defaultStartsAt,
    endsAt: defaultEndsAt,
    tractorUnitId: "",
    trailerId: "",
    primaryDriverId: "",
    secondDriverId: "",
    notes: "",
  });

  // A <select>'s value prop is unchanged across the failed-submit render, so
  // React's diff never restores what the native reset clobbered. These refs put
  // it back.
  const tractorRef = useRef<HTMLSelectElement>(null);
  const trailerRef = useRef<HTMLSelectElement>(null);
  const primaryRef = useRef<HTMLSelectElement>(null);
  const secondRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (tractorRef.current) tractorRef.current.value = fields.tractorUnitId;
    if (trailerRef.current) trailerRef.current.value = fields.trailerId;
    if (primaryRef.current) primaryRef.current.value = fields.primaryDriverId;
    if (secondRef.current) secondRef.current.value = fields.secondDriverId;
  }, [state, fields]);

  function update<K extends keyof typeof fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      {/* Set once the user has seen the warning: the next submit goes through. */}
      {state.conflicts.length > 0 && (
        <input type="hidden" name="acceptConflicts" value="true" />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="startsAt">Început</Label>
        <Input
          id="startsAt"
          name="startsAt"
          type="date"
          value={fields.startsAt}
          onChange={(e) => update("startsAt", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endsAt">Sfârșit</Label>
        <Input
          id="endsAt"
          name="endsAt"
          type="date"
          value={fields.endsAt}
          onChange={(e) => update("endsAt", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tractorUnitId">Cap tractor</Label>
        <select
          id="tractorUnitId"
          name="tractorUnitId"
          ref={tractorRef}
          value={fields.tractorUnitId}
          onChange={(e) => update("tractorUnitId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {tractorUnits.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trailerId">Semiremorcă</Label>
        <select
          id="trailerId"
          name="trailerId"
          ref={trailerRef}
          value={fields.trailerId}
          onChange={(e) => update("trailerId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciuna —</option>
          {trailers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="primaryDriverId">Șofer principal</Label>
        <select
          id="primaryDriverId"
          name="primaryDriverId"
          ref={primaryRef}
          value={fields.primaryDriverId}
          onChange={(e) => update("primaryDriverId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {drivers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secondDriverId">Al doilea șofer</Label>
        <select
          id="secondDriverId"
          name="secondDriverId"
          ref={secondRef}
          value={fields.secondDriverId}
          onChange={(e) => update("secondDriverId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {drivers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
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

      {state.conflicts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          <p className="font-medium">Resurse deja ocupate în acest interval:</p>
          <ul className="list-inside list-disc">
            {state.conflicts.map((c, i) => (
              <li key={i}>
                {c.resourceLabel} — cursa {c.tripNumber}
              </li>
            ))}
          </ul>
          <p>Apasă din nou pe buton dacă vrei să continui oricum.</p>
        </div>
      )}
      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : "Creează cursa"}
        </Button>
      </div>
    </form>
  );
}
