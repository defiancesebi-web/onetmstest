"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { attachOrderAction, detachOrderAction, type TripFormState } from "../actions";
import { Button } from "@/components/ui/button";

export type AttachedOrder = { id: string; orderNumber: string; clientName: string };
export type AttachableOrder = { id: string; label: string };

export function TripOrders({
  tripId,
  editable,
  attached,
  attachable,
}: {
  tripId: string;
  editable: boolean;
  attached: AttachedOrder[];
  attachable: AttachableOrder[];
}) {
  const boundAttach = attachOrderAction.bind(null, tripId);
  const [state, formAction, pending] = useActionState<TripFormState, FormData>(boundAttach, {
    error: null,
    conflicts: [],
  });

  const [orderId, setOrderId] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (selectRef.current) selectRef.current.value = orderId;
  }, [state, orderId]);

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium">Comenzi pe această cursă</h2>

      {attached.length === 0 ? (
        <p className="text-muted-foreground mb-4 rounded-lg border border-dashed p-6 text-center text-sm">
          Nicio comandă atașată.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {attached.map((order) => (
            <li key={order.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>
                <Link href={`/dashboard/comenzi/${order.id}`} className="underline">
                  {order.orderNumber}
                </Link>
                <span className="text-muted-foreground"> · {order.clientName}</span>
              </span>
              {editable && (
                <form action={detachOrderAction.bind(null, order.id, tripId)}>
                  <Button type="submit" size="sm" variant="outline">
                    Desprinde
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && attachable.length > 0 && (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <select
            name="orderId"
            ref={selectRef}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="rounded-lg border px-2 py-2 text-sm"
          >
            <option value="">— alege o comandă —</option>
            {attachable.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Se atașează..." : "Atașează"}
          </Button>
          {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
