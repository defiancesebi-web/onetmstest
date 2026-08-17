"use client";

import { useState, useTransition } from "react";
import { ALLOWED_TRANSITIONS, ORDER_STATUS_LABELS } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { updateOrderStatusAction } from "../actions";
import { Button } from "@/components/ui/button";

export function StatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  // Kept here, on the container, rather than per-button: this component
  // isn't remounted by a status-prop refresh, so the message survives the
  // automatic page refresh a server action triggers. A per-button state
  // would be discarded by that same refresh — see the comment on
  // updateOrderStatusAction for why.
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextStates = ALLOWED_TRANSITIONS[status];

  function handleClick(to: OrderStatus) {
    // Cancellation is terminal — there is no transition out of CANCELLED and
    // orders are never deleted — so a misclick would permanently kill an
    // order that keeps its number forever.
    if (
      to === "CANCELLED" &&
      !window.confirm("Sigur anulezi comanda? Anularea este definitivă și nu poate fi revenită.")
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, to);
      if (result.error) setError(result.error);
    });
  }

  if (nextStates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Comanda este în stare finală — nu mai poate fi schimbată.
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
            variant={next === "CANCELLED" ? "destructive" : "default"}
            size="sm"
            disabled={pending}
            onClick={() => handleClick(next)}
          >
            {next === "CANCELLED" ? "Anulează comanda" : `Marchează: ${ORDER_STATUS_LABELS[next]}`}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
