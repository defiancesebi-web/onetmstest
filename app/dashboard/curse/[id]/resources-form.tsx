"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTripResourcesAction, type TripFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import type { ResourceOption } from "../noua/new-trip-form";

export function TripResourcesForm({
  tripId,
  tractorUnits,
  trailers,
  drivers,
  values,
  t,
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
    distanceKm: string;
  };
  t: Dictionary["tripForm"];
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

  useEffect(() => {
    // Native <select>s can desync from controlled state after the conflict
    // re-render; force the DOM value back. Driver pickers are Comboboxes, which
    // always render from `value`, so they need no such sync.
    if (tractorRef.current) tractorRef.current.value = fields.tractorUnitId;
    if (trailerRef.current) trailerRef.current.value = fields.trailerId;
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
    // Every field except km feeds findResourceConflicts; km cannot stale an acceptance.
    if (key !== "distanceKm") setEditedAgainst(state);
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
        <Label htmlFor="startsAt">{t.start}</Label>
        <DatePicker
          id="startsAt"
          name="startsAt"
          value={fields.startsAt}
          onChange={(v) => update("startsAt", v)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endsAt">{t.end}</Label>
        <DatePicker
          id="endsAt"
          name="endsAt"
          value={fields.endsAt}
          onChange={(v) => update("endsAt", v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tractorUnitId">{t.tractor}</Label>
        <select
          id="tractorUnitId"
          name="tractorUnitId"
          ref={tractorRef}
          value={fields.tractorUnitId}
          onChange={(e) => update("tractorUnitId", e.target.value)}
          className="w-full select-native"
        >
          <option value="">{t.none}</option>
          {tractorUnits.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trailerId">{t.trailer}</Label>
        <select
          id="trailerId"
          name="trailerId"
          ref={trailerRef}
          value={fields.trailerId}
          onChange={(e) => update("trailerId", e.target.value)}
          className="w-full select-native"
        >
          <option value="">{t.noneFem}</option>
          {trailers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="primaryDriverId">{t.primaryDriver}</Label>
        <Combobox
          id="primaryDriverId"
          name="primaryDriverId"
          value={fields.primaryDriverId}
          onChange={(v) => update("primaryDriverId", v)}
          options={drivers.map((d) => ({ value: d.id, label: d.label }))}
          noneLabel={t.none}
          showAvatars
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secondDriverId">{t.secondDriver}</Label>
        <Combobox
          id="secondDriverId"
          name="secondDriverId"
          value={fields.secondDriverId}
          onChange={(v) => update("secondDriverId", v)}
          options={drivers.map((d) => ({ value: d.id, label: d.label }))}
          noneLabel={t.none}
          showAvatars
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="distanceKm">{t.distanceKm}</Label>
        <Input
          id="distanceKm"
          name="distanceKm"
          type="number"
          step="0.1"
          min="0"
          value={fields.distanceKm}
          onChange={(e) => update("distanceKm", e.target.value)}
        />
      </div>

      {state.conflicts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          <p className="font-medium">{t.conflictsTitle}</p>
          <ul className="list-inside list-disc">
            {state.conflicts.map((c, i) => (
              <li key={i}>
                {c.resourceLabel} — {t.conflictTrip} {c.tripNumber}
              </li>
            ))}
          </ul>
          <p>{t.conflictAgain}</p>
        </div>
      )}
      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.saveAllocation}
        </Button>
      </div>
    </form>
  );
}
