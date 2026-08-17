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
  const nextStates = ALLOWED_TRANSITIONS[status];

  if (nextStates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Comanda este în stare finală — nu mai poate fi schimbată.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStates.map((next) => (
        <form key={next} action={updateOrderStatusAction.bind(null, orderId, next)}>
          <Button type="submit" variant={next === "CANCELLED" ? "destructive" : "default"} size="sm">
            {next === "CANCELLED" ? "Anulează comanda" : `Marchează: ${ORDER_STATUS_LABELS[next]}`}
          </Button>
        </form>
      ))}
    </div>
  );
}
