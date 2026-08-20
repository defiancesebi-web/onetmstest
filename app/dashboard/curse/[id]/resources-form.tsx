"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTripResourcesAction, type TripFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceOption } from "../noua/new-trip-form";

export function TripResourcesForm({
  tripId,
  tractorUnits,
  trailers,
  drivers,
  values,
}: {
  tripId: string;
  tractorUnits: ResourceOption[];
  trailers: ResourceOption[];
  drivers: ResourceOption[];
  values: {
    startsAt: string;
    endsAt: string;
    tractorUnitId: string;
    trailerId: string;
    primaryDriverId: string;
    secondDriverId: string;
  };
}) {
  const boundAction = updateTripResourcesAction.bind(null, tripId);
  const [state, formAction, pending] = useActionState<TripFormState, FormData>(boundAction, {
    error: null,
    conflicts: [],
  });

  const [fields, setFields] = useState(values);
  const [datesChanged, setDatesChanged] = useState(false);

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

  // The acceptance belongs to the selection that was warned about, not to the
  // form. Without this, a dispatcher warned that truck A is busy could switch
  // to truck B and submit — and B's conflicts would never be checked, silently
  // losing a warning they never declined. Held as "which action result was on
  // screen when the user last touched the selection" rather than a boolean, so
  // a fresh result (a re-warning) revives the acceptance on its own, with no
  // effect and no cascading render.
  const [editedAgainst, setEditedAgainst] = useState<TripFormState | null>(null);
  const conflictsAccepted = state.conflicts.length > 0 && editedAgainst !== state;

  function update<K extends keyof typeof fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (key === "startsAt" || key === "endsAt") setDatesChanged(true);
    // Every field on this form feeds findResourceConflicts.
    setEditedAgainst(state);
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {/* Bound to the resources and dates that were warned about, not to the
          form: changing any of them drops the acceptance so the replacement is
          checked too. */}
      {conflictsAccepted && <input type="hidden" name="acceptConflicts" value="true" />}
      {/* Only a deliberate edit pins the dates; otherwise attaching an order may
          keep recalculating them. */}
      <input type="hidden" name="datesChanged" value={datesChanged ? "true" : "false"} />

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
          {pending ? "Se salvează..." : "Salvează alocarea"}
        </Button>
      </div>
    </form>
  );
}
