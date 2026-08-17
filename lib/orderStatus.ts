import type { OrderStatus, StopType } from "@/lib/generated/prisma/enums";

export class InvalidStatusTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      `Nu se poate trece din "${ORDER_STATUS_LABELS[from]}" în "${ORDER_STATUS_LABELS[to]}".`
    );
    this.name = "InvalidStatusTransitionError";
  }
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Nouă",
  CONFIRMED: "Confirmată",
  IN_PROGRESS: "În execuție",
  DELIVERED: "Livrată",
  DOCUMENTS_RECEIVED: "Documente primite",
  INVOICED: "Facturată",
  CANCELLED: "Anulată",
};

export const STOP_TYPE_LABELS: Record<StopType, string> = {
  LOADING: "Încărcare",
  UNLOADING: "Descărcare",
};

/** INVOICED and CANCELLED are terminal: nothing leaves them. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["DOCUMENTS_RECEIVED", "CANCELLED"],
  DOCUMENTS_RECEIVED: ["INVOICED", "CANCELLED"],
  INVOICED: [],
  CANCELLED: [],
};

export function assertTransitionAllowed(from: OrderStatus, to: OrderStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}
