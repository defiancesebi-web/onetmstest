"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTripAction, type TripFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

export type ResourceOption = { id: string; label: string };

export function NewTripForm({
  tractorUnits,
  trailers,
  drivers,
  orderId,
  defaultStartsAt,
  defaultEndsAt,
  t,
}: {
  tractorUnits: ResourceOption[];
  trailers: ResourceOption[];
  drivers: ResourceOption[];
  orderId?: string;
  defaultStartsAt: string;
  defaultEndsAt: string;
  t: Dictionary["tripForm"];
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
    distanceKm: "",
    notes: "",
  });

  // A <select>'s value prop is unchanged across the failed-submit render, so
  // React's diff never restores what the native reset clobbered. These refs put
  // it back.
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

  // Two-step wizard: 1 = trip details (dates/km/notes), 2 = assign resources.
  const [step, setStep] = useState(1);

  function update<K extends keyof typeof fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    // Notes and km do not feed findResourceConflicts, so they cannot stale an acceptance.
    if (key !== "notes" && key !== "distanceKm") setEditedAgainst(state);
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      {/* Set once the user has seen the warning for *these* resources and dates:
          the next submit goes through. Changing either drops it again. */}
      {conflictsAccepted && <input type="hidden" name="acceptConflicts" value="true" />}

      <Stepper steps={[t.step1, t.step2]} current={step} stepWord={t.stepWord} />

      {/* Step 1 — trip details. Kept mounted (hidden) so its fields still submit. */}
      <div className={cn("grid gap-4 sm:grid-cols-2", step !== 1 && "hidden")}>
        <div className="space-y-1.5">
          <Label htmlFor="startsAt">{t.start}</Label>
          <DatePicker id="startsAt" name="startsAt" value={fields.startsAt} onChange={(v) => update("startsAt", v)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt">{t.end}</Label>
          <DatePicker id="endsAt" name="endsAt" value={fields.endsAt} onChange={(v) => update("endsAt", v)} />
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">{t.notes}</Label>
          <Input id="notes" name="notes" value={fields.notes} onChange={(e) => update("notes", e.target.value)} />
        </div>
      </div>

      {/* Step 2 — assign resources. */}
      <div className={cn("grid gap-4 sm:grid-cols-2", step !== 2 && "hidden")}>
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
      </div>

      {state.conflicts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
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
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center justify-between">
        {step === 2 ? (
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            {t.wizardBack}
          </Button>
        ) : (
          <span />
        )}
        {step === 1 ? (
          <Button type="button" onClick={() => setStep(2)}>
            {t.wizardNext}
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? t.saving : t.create}
          </Button>
        )}
      </div>
    </form>
  );
}
