"use client";

import { useState, useTransition } from "react";
import { ALLOWED_TRIP_TRANSITIONS, TRIP_STATUS_LABELS } from "@/lib/tripStatus";
import type { TripStatus } from "@/lib/generated/prisma/enums";
import { updateTripStatusAction } from "../actions";
import { Button } from "@/components/ui/button";

export function TripStatusActions({
  tripId,
  status,
}: {
  tripId: string;
  status: TripStatus;
}) {
  // Kept here, on the container, rather than per-button: this component isn't
  // remounted by a status-prop refresh, so the message survives the automatic
  // page refresh a server action triggers. A per-button state would be
  // discarded by that same refresh — see the comment on updateTripStatusAction.
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextStates = ALLOWED_TRIP_TRANSITIONS[status];

  function handleClick(next: TripStatus) {
    if (next === "CANCELLED") {
      // Cancelling is terminal and detaches every order — worth a pause.
      if (!window.confirm("Anulezi cursa? Comenzile ei revin la neplanificate.")) return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateTripStatusAction(tripId, next);
      if (result.error) setError(result.error);
    });
  }

  if (nextStates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Cursa este în stare finală — nu mai poate fi schimbată.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {nextStates.map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            disabled={pending}
            variant={next === "CANCELLED" ? "destructive" : "default"}
            onClick={() => handleClick(next)}
          >
            {next === "CANCELLED" ? "Anulează cursa" : `Marchează: ${TRIP_STATUS_LABELS[next]}`}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
