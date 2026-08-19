import { describe, it, expect } from "vitest";
import {
  formatTripNumber,
  datesOverlap,
  assertTripTransitionAllowed,
  InvalidTripStatusTransitionError,
  ALLOWED_TRIP_TRANSITIONS,
  TRIP_STATUS_LABELS,
  TRIP_EDITABLE_STATUSES,
} from "@/lib/tripStatus";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

describe("formatTripNumber", () => {
  it("prefixează cu C ca să nu se confunde cu numărul unei comenzi", () => {
    expect(formatTripNumber(2026, 1)).toBe("C-2026-0001");
    expect(formatTripNumber(2026, 42)).toBe("C-2026-0042");
    expect(formatTripNumber(2026, 1234)).toBe("C-2026-1234");
  });
});

describe("datesOverlap", () => {
  it("consideră suprapuse două curse care se ating într-o singură zi", () => {
    // A camion cannot be in two places on the same calendar day, so touching
    // ends count as a conflict.
    expect(datesOverlap(d("2026-09-01"), d("2026-09-05"), d("2026-09-05"), d("2026-09-08"))).toBe(
      true
    );
  });

  it("nu consideră suprapuse două curse consecutive", () => {
    expect(datesOverlap(d("2026-09-01"), d("2026-09-05"), d("2026-09-06"), d("2026-09-08"))).toBe(
      false
    );
  });

  it("detectează o cursă complet cuprinsă în alta", () => {
    expect(datesOverlap(d("2026-09-01"), d("2026-09-10"), d("2026-09-03"), d("2026-09-04"))).toBe(
      true
    );
  });

  it("detectează suprapunerea indiferent de ordinea argumentelor", () => {
    expect(datesOverlap(d("2026-09-05"), d("2026-09-08"), d("2026-09-01"), d("2026-09-06"))).toBe(
      true
    );
  });

  it("tratează o cursă de o singură zi", () => {
    expect(datesOverlap(d("2026-09-03"), d("2026-09-03"), d("2026-09-03"), d("2026-09-03"))).toBe(
      true
    );
    expect(datesOverlap(d("2026-09-03"), d("2026-09-03"), d("2026-09-04"), d("2026-09-04"))).toBe(
      false
    );
  });
});

describe("assertTripTransitionAllowed", () => {
  it("permite parcursul normal", () => {
    expect(() => assertTripTransitionAllowed("PLANNED", "IN_PROGRESS")).not.toThrow();
    expect(() => assertTripTransitionAllowed("IN_PROGRESS", "COMPLETED")).not.toThrow();
  });

  it("permite anularea din stările nefinale", () => {
    expect(() => assertTripTransitionAllowed("PLANNED", "CANCELLED")).not.toThrow();
    expect(() => assertTripTransitionAllowed("IN_PROGRESS", "CANCELLED")).not.toThrow();
  });

  it("respinge sărirea peste etape", () => {
    expect(() => assertTripTransitionAllowed("PLANNED", "COMPLETED")).toThrow(
      InvalidTripStatusTransitionError
    );
  });

  it("respinge întoarcerea", () => {
    expect(() => assertTripTransitionAllowed("IN_PROGRESS", "PLANNED")).toThrow(
      InvalidTripStatusTransitionError
    );
  });

  it("tratează ÎNCHEIATĂ și ANULATĂ ca stări finale", () => {
    expect(ALLOWED_TRIP_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ALLOWED_TRIP_TRANSITIONS.CANCELLED).toEqual([]);
    expect(() => assertTripTransitionAllowed("COMPLETED", "CANCELLED")).toThrow(
      InvalidTripStatusTransitionError
    );
  });

  it("respinge tranziția către aceeași stare", () => {
    expect(() => assertTripTransitionAllowed("PLANNED", "PLANNED")).toThrow(
      InvalidTripStatusTransitionError
    );
  });
});

describe("etichete și stări editabile", () => {
  it("are o etichetă în română pentru fiecare stare", () => {
    expect(TRIP_STATUS_LABELS.PLANNED).toBe("Planificată");
    expect(TRIP_STATUS_LABELS.IN_PROGRESS).toBe("În execuție");
    expect(TRIP_STATUS_LABELS.COMPLETED).toBe("Încheiată");
    expect(TRIP_STATUS_LABELS.CANCELLED).toBe("Anulată");
    expect(Object.keys(TRIP_STATUS_LABELS)).toHaveLength(4);
  });

  it("permite modificarea conținutului doar în stările nefinale", () => {
    expect(TRIP_EDITABLE_STATUSES).toEqual(["PLANNED", "IN_PROGRESS"]);
  });
});
