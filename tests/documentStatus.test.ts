import { describe, it, expect } from "vitest";
import {
  documentStatus,
  aggregateOwnerStatus,
  todayKeyInBucharest,
  toDateKey,
  EXPIRY_WARNING_DAYS,
  DOCUMENT_TYPE_LABELS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_DOCUMENT_TYPES,
  DRIVER_DOCUMENT_TYPES,
} from "@/lib/documentStatus";

// A fixed "now" so the tests never depend on the day they run.
const NOW = new Date("2026-08-18T09:00:00Z");

function dateOnly(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

describe("documentStatus", () => {
  it("marchează ca expirat un document de ieri", () => {
    expect(documentStatus(dateOnly("2026-08-17"), NOW)).toBe("EXPIRED");
  });

  it("marchează ca expirând curând un document care expiră azi", () => {
    expect(documentStatus(dateOnly("2026-08-18"), NOW)).toBe("EXPIRING_SOON");
  });

  it("marchează ca expirând curând un document la exact 30 de zile", () => {
    expect(documentStatus(dateOnly("2026-09-17"), NOW)).toBe("EXPIRING_SOON");
  });

  it("marchează ca valid un document la 31 de zile", () => {
    expect(documentStatus(dateOnly("2026-09-18"), NOW)).toBe("VALID");
  });

  it("folosește ziua din România, nu ora serverului", () => {
    // 2026-08-18T21:30Z is already 2026-08-19 in Bucharest (UTC+3 in summer),
    // so a document expiring on the 18th is already expired there.
    const lateEvening = new Date("2026-08-18T21:30:00Z");
    expect(documentStatus(dateOnly("2026-08-18"), lateEvening)).toBe("EXPIRED");
  });
});

describe("todayKeyInBucharest", () => {
  it("returnează ziua în format YYYY-MM-DD", () => {
    expect(todayKeyInBucharest(NOW)).toBe("2026-08-18");
  });

  it("trece la ziua următoare seara devreme, față de UTC", () => {
    expect(todayKeyInBucharest(new Date("2026-08-18T21:30:00Z"))).toBe("2026-08-19");
  });
});

describe("toDateKey", () => {
  it("citește o dată stocată ca @db.Date fără să o mute cu o zi", () => {
    expect(toDateKey(dateOnly("2026-08-18"))).toBe("2026-08-18");
  });
});

describe("aggregateOwnerStatus", () => {
  it("returnează NO_DOCUMENTS pentru o listă goală", () => {
    expect(aggregateOwnerStatus([])).toBe("NO_DOCUMENTS");
  });

  it("alege starea cea mai gravă", () => {
    expect(aggregateOwnerStatus(["VALID", "EXPIRED", "EXPIRING_SOON"])).toBe("EXPIRED");
    expect(aggregateOwnerStatus(["VALID", "EXPIRING_SOON"])).toBe("EXPIRING_SOON");
    expect(aggregateOwnerStatus(["VALID", "VALID"])).toBe("VALID");
  });
});

describe("etichete și liste de tipuri", () => {
  it("are o etichetă în română pentru fiecare tip de document", () => {
    expect(DOCUMENT_TYPE_LABELS.ITP).toBe("ITP");
    expect(DOCUMENT_TYPE_LABELS.COPIE_CONFORMA).toBe("Copie conformă");
    expect(DOCUMENT_TYPE_LABELS.PERMIS_CONDUCERE).toBe("Permis de conducere");
    expect(Object.keys(DOCUMENT_TYPE_LABELS)).toHaveLength(12);
  });

  it("are o etichetă în română pentru fiecare tip de vehicul", () => {
    expect(VEHICLE_TYPE_LABELS.TRACTOR_UNIT).toBe("Cap tractor");
    expect(VEHICLE_TYPE_LABELS.VAN_3_5T).toBe("Dubă 3.5t");
    expect(Object.keys(VEHICLE_TYPE_LABELS)).toHaveLength(4);
  });

  it("împarte tipurile de documente între vehicule și șoferi, fără suprapunere", () => {
    expect(VEHICLE_DOCUMENT_TYPES).toHaveLength(7);
    expect(DRIVER_DOCUMENT_TYPES).toHaveLength(5);
    const overlap = VEHICLE_DOCUMENT_TYPES.filter((t) =>
      (DRIVER_DOCUMENT_TYPES as readonly string[]).includes(t)
    );
    expect(overlap).toEqual([]);
  });

  it("pragul de avertizare este 30 de zile", () => {
    expect(EXPIRY_WARNING_DAYS).toBe(30);
  });
});
