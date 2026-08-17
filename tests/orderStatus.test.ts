import { describe, it, expect } from "vitest";
import {
  assertTransitionAllowed,
  InvalidStatusTransitionError,
  ORDER_STATUS_LABELS,
  ALLOWED_TRANSITIONS,
} from "@/lib/orderStatus";

describe("assertTransitionAllowed", () => {
  it("permite parcursul normal al unei comenzi", () => {
    expect(() => assertTransitionAllowed("NEW", "CONFIRMED")).not.toThrow();
    expect(() => assertTransitionAllowed("CONFIRMED", "IN_PROGRESS")).not.toThrow();
    expect(() => assertTransitionAllowed("IN_PROGRESS", "DELIVERED")).not.toThrow();
    expect(() => assertTransitionAllowed("DELIVERED", "DOCUMENTS_RECEIVED")).not.toThrow();
    expect(() => assertTransitionAllowed("DOCUMENTS_RECEIVED", "INVOICED")).not.toThrow();
  });

  it("respinge sărirea peste etape", () => {
    expect(() => assertTransitionAllowed("NEW", "INVOICED")).toThrow(InvalidStatusTransitionError);
    expect(() => assertTransitionAllowed("NEW", "DELIVERED")).toThrow(InvalidStatusTransitionError);
  });

  it("respinge întoarcerea la o stare anterioară", () => {
    expect(() => assertTransitionAllowed("DELIVERED", "NEW")).toThrow(InvalidStatusTransitionError);
  });

  it("permite anularea din orice stare care nu e finală", () => {
    expect(() => assertTransitionAllowed("NEW", "CANCELLED")).not.toThrow();
    expect(() => assertTransitionAllowed("CONFIRMED", "CANCELLED")).not.toThrow();
    expect(() => assertTransitionAllowed("IN_PROGRESS", "CANCELLED")).not.toThrow();
    expect(() => assertTransitionAllowed("DELIVERED", "CANCELLED")).not.toThrow();
    expect(() => assertTransitionAllowed("DOCUMENTS_RECEIVED", "CANCELLED")).not.toThrow();
  });

  it("tratează FACTURATĂ și ANULATĂ ca stări finale", () => {
    expect(ALLOWED_TRANSITIONS.INVOICED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    expect(() => assertTransitionAllowed("INVOICED", "CANCELLED")).toThrow(
      InvalidStatusTransitionError
    );
    expect(() => assertTransitionAllowed("CANCELLED", "NEW")).toThrow(
      InvalidStatusTransitionError
    );
  });

  it("respinge tranziția către aceeași stare", () => {
    expect(() => assertTransitionAllowed("NEW", "NEW")).toThrow(InvalidStatusTransitionError);
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("are o etichetă în română pentru fiecare stare", () => {
    expect(ORDER_STATUS_LABELS.NEW).toBe("Nouă");
    expect(ORDER_STATUS_LABELS.DOCUMENTS_RECEIVED).toBe("Documente primite");
    expect(ORDER_STATUS_LABELS.CANCELLED).toBe("Anulată");
    expect(Object.keys(ORDER_STATUS_LABELS)).toHaveLength(7);
  });
});
