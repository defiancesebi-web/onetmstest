"use client";

import { useState, useTransition } from "react";
import { ALLOWED_TRANSITIONS } from "@/lib/orderStatus";
import { orderStatusLabel } from "@/lib/labels";
import type { Locale, Dictionary } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { updateOrderStatusAction } from "../actions";
import { Button } from "@/components/ui/button";

export function StatusActions({
  orderId,
  status,
  locale,
  t,
}: {
  orderId: string;
  status: OrderStatus;
  locale: Locale;
  t: Dictionary["order"];
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
    if (to === "CANCELLED" && !window.confirm(t.cancelConfirm)) {
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
      <p className="text-muted-foreground text-sm">{t.statusFinal}</p>
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
            {next === "CANCELLED" ? t.cancelOrder : `${t.markAs} ${orderStatusLabel(next, locale)}`}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
