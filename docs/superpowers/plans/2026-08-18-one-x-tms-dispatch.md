# ONE x TMS — Modulul 4: Dispecerat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a dispatcher form trips, assign a tractor unit, trailer and up to two drivers, attach orders to them, and be warned when a resource is already busy.

**Architecture:** Extends the existing Next.js 16 App Router monolith. A new `Trip` model carries the assignment; `Order` gains a nullable `tripId`, so one trip can carry several orders (groupage) while the common case stays one order per trip. Pure logic — status transitions, date overlap, number formatting — lives in a database-free module so it can be tested exhaustively at its boundaries. Trip numbering reuses the advisory-lock pattern proven in `lib/data/orders.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`), PostgreSQL (Neon), Auth.js v5, Tailwind CSS v4, shadcn/ui, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-18-one-x-tms-dispatch-design.md](../specs/2026-08-18-one-x-tms-dispatch-design.md)

## Global Constraints

- All user-facing text (labels, buttons, placeholders, option text, error messages) is Romanian. Enum values stay English.
- Every function that reads or writes company-scoped data MUST call `assertCompanyAccess(session, companyId)` from `lib/tenancy.ts` before the query, or reach it through a helper that does. Several carriers share one database — this is the core security invariant.
- Cross-tenant access returns **404** via `null` from read functions; write functions throw `TenantAccessError`. Never 403.
- A not-found id surfaces a Romanian product error class, never a raw Prisma error. `findUniqueOrThrow` is banned for this.
- Dates that decide anything are evaluated in **`Europe/Bucharest`**, never server-local time — the server runs UTC.
- **Overlap is inclusive at both ends**: two trips that merely touch on one day are overlapping. Cancelled trips never occupy a resource.
- **Overlaps warn, never block.** The caller decides.
- **Propagation can only advance an order**, never move it backwards. A trip completing must not pull an already-invoiced order back to delivered.
- **React 19 resets a `<form action>` after every action call.** Any form whose action can return an error MUST use controlled inputs backed by React state. A `<select>` needs more: pair it with a ref and an effect that rewrites `ref.current.value` when the action state or the value changes, because React's diff will not restore a select the native reset clobbered. Both defects shipped in earlier modules before being caught.
- This project's `Button` is Base UI based and does NOT support `asChild`; links styled as buttons use `buttonVariants()`.
- Next.js 16: `params` and `searchParams` are Promises and must be awaited.
- TypeScript strict; no `any`. No placeholder code, no `TODO`.

---

## Task 1: Model Trip + legătura pe Order

**Files:**
- Modify: `prisma/schema.prisma`, `tests/helpers/db.ts`
- Create: `prisma/migrations/<timestamp>_add_trip/migration.sql` (generated)

**Interfaces:**
- Produces: `Trip` model, enum `TripStatus`, `Order.tripId`, types `TripModel`. Consumed by Tasks 3-8.

- [ ] **Step 1: Adaugă enum-ul și modelul**

Modify `prisma/schema.prisma` — add at the end of the file:

```prisma
enum TripStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model Trip {
  id                  String     @id @default(cuid())
  companyId           String
  year                Int
  sequence            Int
  tripNumber          String
  tractorUnitId       String?
  trailerId           String?
  primaryDriverId     String?
  secondDriverId      String?
  startsAt            DateTime   @db.Date
  endsAt              DateTime   @db.Date
  /// Once the dispatcher edits the dates by hand, attaching an order must stop
  /// silently overwriting them — that would erase a manually added return day,
  /// which is exactly the date overlap detection reads.
  datesEditedManually Boolean    @default(false)
  status              TripStatus @default(PLANNED)
  notes               String?
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  company     Company  @relation(fields: [companyId], references: [id])
  tractorUnit Vehicle? @relation("TripTractorUnit", fields: [tractorUnitId], references: [id])
  trailer     Vehicle? @relation("TripTrailer", fields: [trailerId], references: [id])
  primaryDriver Driver? @relation("TripPrimaryDriver", fields: [primaryDriverId], references: [id])
  secondDriver  Driver? @relation("TripSecondDriver", fields: [secondDriverId], references: [id])
  orders      Order[]

  @@unique([companyId, year, sequence])
  @@unique([companyId, tripNumber])
  @@index([companyId, status])
  @@index([companyId, startsAt])
}
```

- [ ] **Step 2: Adaugă câmpul pe Order și relațiile inverse**

Modify `prisma/schema.prisma`.

Inside `model Order`, add the field after `documentsReceivedAt`:

```prisma
  tripId              String?
```

and add to its relation block, next to `client`:

```prisma
  trip    Trip?       @relation(fields: [tripId], references: [id])
```

and add to its index list:

```prisma
  @@index([companyId, tripId])
```

Inside `model Company`, next to `vehicles`/`drivers`:

```prisma
  trips       Trip[]
```

Inside `model Vehicle`, after the `company` relation line — two named relations, because a vehicle can be either half of a rig:

```prisma
  tripsAsTractorUnit Trip[] @relation("TripTractorUnit")
  tripsAsTrailer     Trip[] @relation("TripTrailer")
```

Inside `model Driver`, after the `company` relation line:

```prisma
  tripsAsPrimaryDriver Trip[] @relation("TripPrimaryDriver")
  tripsAsSecondDriver  Trip[] @relation("TripSecondDriver")
```

- [ ] **Step 3: Rulează migrarea pe baza de dezvoltare**

Run: `npx prisma migrate dev --name add_trip`
Expected: migration applies, `Trip` table created and `Order.tripId` added.

If Neon returns a transient `P1001` (cold start), retry the command once.

- [ ] **Step 4: Aplică migrarea pe baza de test**

Run (bash):
```bash
DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d'"' -f2) npx prisma migrate deploy
```

Run (PowerShell):
```bash
$env:DATABASE_URL=(Get-Content .env.test | Select-String 'DATABASE_URL' | ForEach-Object { $_ -replace 'DATABASE_URL=','' -replace '"','' }); npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 5: Extinde curățarea bazei de test**

Orders reference trips, so orders must be cleared before trips, and trips before the vehicles and drivers they point at.

Modify `tests/helpers/db.ts` — replace the body of `resetDatabase`:

```ts
export async function resetDatabase() {
  await prisma.document.deleteMany();
  await prisma.orderStop.deleteMany();
  await prisma.order.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
```

- [ ] **Step 6: Regenerează, verifică tipurile și testele**

Run: `npx prisma generate && npx tsc --noEmit && npm test`
Expected: `tsc` silent, all existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/ tests/helpers/db.ts
git commit -m "feat: add Trip model and order-to-trip link"
```

---

## Task 2: Logica pură a curselor

**Files:**
- Create: `lib/tripStatus.ts`
- Test: `tests/tripStatus.test.ts`

**Interfaces:**
- Consumes: `TripStatus` from `@/lib/generated/prisma/enums`.
- Produces:
  - `formatTripNumber(year: number, sequence: number): string`
  - `datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean`
  - `ALLOWED_TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]>`
  - `assertTripTransitionAllowed(from: TripStatus, to: TripStatus): void`
  - `InvalidTripStatusTransitionError`
  - `TRIP_STATUS_LABELS: Record<TripStatus, string>`
  - `TRIP_EDITABLE_STATUSES: readonly TripStatus[]`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/tripStatus.test.ts`:

```ts
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
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/tripStatus.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/tripStatus.ts`:

```ts
import type { TripStatus } from "@/lib/generated/prisma/enums";

export class InvalidTripStatusTransitionError extends Error {
  constructor(from: TripStatus, to: TripStatus) {
    super(
      `Nu se poate trece cursa din "${TRIP_STATUS_LABELS[from]}" în "${TRIP_STATUS_LABELS[to]}".`
    );
    this.name = "InvalidTripStatusTransitionError";
  }
}

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  PLANNED: "Planificată",
  IN_PROGRESS: "În execuție",
  COMPLETED: "Încheiată",
  CANCELLED: "Anulată",
};

/** COMPLETED and CANCELLED are terminal: nothing leaves them. */
export const ALLOWED_TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * A finished or cancelled trip is a past fact. Changing what it carried would
 * rewrite the history the cost module will later read.
 */
export const TRIP_EDITABLE_STATUSES = ["PLANNED", "IN_PROGRESS"] as const satisfies readonly TripStatus[];

export function assertTripTransitionAllowed(from: TripStatus, to: TripStatus): void {
  if (!ALLOWED_TRIP_TRANSITIONS[from].includes(to)) {
    throw new InvalidTripStatusTransitionError(from, to);
  }
}

/** `C-` distinguishes a trip number from an order number at a glance — both are otherwise `YYYY-NNNN`. */
export function formatTripNumber(year: number, sequence: number): string {
  return `C-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Inclusive at both ends: trips that merely touch on one day still conflict,
 * because a vehicle cannot be in two places on the same calendar day. Both
 * columns are `@db.Date`, so Prisma hands them back at UTC midnight and a plain
 * timestamp comparison is exact.
 */
export function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tripStatus.ts tests/tripStatus.test.ts
git commit -m "feat: add trip status rules and overlap arithmetic"
```

---

## Task 3: Crearea cursei, cu numerotare

**Files:**
- Create: `lib/data/trips.ts`
- Test: `tests/data/trips.test.ts`

**Interfaces:**
- Consumes: `prisma`, `assertCompanyAccess`/`SessionUser`/`TenantAccessError`, `formatTripNumber` (Task 2), `currentOrderYear` from `@/lib/data/orders.ts`, `Prisma` namespace.
- Produces:
  - `createTrip(session: SessionUser, input: CreateTripInput): Promise<TripModel>`
  - types `CreateTripInput`
  - classes `TripNotFoundError`, `InvalidTripError`, `TripNumberingError`
  - `MAX_TRIP_NUMBERING_ATTEMPTS`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/trips.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createTrip, InvalidTripError } from "@/lib/data/trips";
import { currentOrderYear } from "@/lib/data/orders";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

function tripInput(companyId: string, overrides = {}) {
  return {
    companyId,
    startsAt: d("2026-09-01"),
    endsAt: d("2026-09-05"),
    ...overrides,
  };
}

describe("createTrip", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează o cursă planificată, fără resurse alocate", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const trip = await createTrip(session, tripInput(company.id));

    expect(trip.status).toBe("PLANNED");
    expect(trip.tripNumber).toBe(`C-${currentOrderYear()}-0001`);
    expect(trip.tractorUnitId).toBeNull();
    expect(trip.primaryDriverId).toBeNull();
    expect(trip.datesEditedManually).toBe(false);
  });

  it("numerotează secvențial în cadrul firmei", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const first = await createTrip(session, tripInput(company.id));
    const second = await createTrip(session, tripInput(company.id));

    expect(second.sequence).toBe(first.sequence + 1);
  });

  it("numerotează independent pentru fiecare firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await createTrip({ role: "COMPANY_ADMIN", companyId: a.id }, tripInput(a.id));
    const tripB = await createTrip({ role: "COMPANY_ADMIN", companyId: b.id }, tripInput(b.id));

    expect(tripB.sequence).toBe(1);
  });

  it("nu dă același număr la curse create simultan", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const results = await Promise.all([
      createTrip(session, tripInput(company.id)),
      createTrip(session, tripInput(company.id)),
      createTrip(session, tripInput(company.id)),
    ]);

    expect(new Set(results.map((t) => t.tripNumber)).size).toBe(3);
    expect(results.map((t) => t.sequence).sort((x, y) => x - y)).toEqual([1, 2, 3]);
  });

  it("acceptă resurse la creare", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const tractor = await prisma.vehicle.create({
      data: { companyId: company.id, registrationNumber: "B-1-AAA", type: "TRACTOR_UNIT" },
    });
    const driver = await prisma.driver.create({
      data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
    });

    const trip = await createTrip(
      session,
      tripInput(company.id, { tractorUnitId: tractor.id, primaryDriverId: driver.id })
    );

    expect(trip.tractorUnitId).toBe(tractor.id);
    expect(trip.primaryDriverId).toBe(driver.id);
  });

  it("respinge un vehicul care aparține altei firme", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const foreign = await prisma.vehicle.create({
      data: { companyId: b.id, registrationNumber: "CJ-9-ZZZ", type: "TRACTOR_UNIT" },
    });

    await expect(
      createTrip(
        { role: "COMPANY_ADMIN", companyId: a.id },
        tripInput(a.id, { tractorUnitId: foreign.id })
      )
    ).rejects.toThrow(InvalidTripError);
  });

  it("respinge un șofer dezactivat", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const driver = await prisma.driver.create({
      data: { companyId: company.id, firstName: "Ion", lastName: "Popescu", isActive: false },
    });

    await expect(
      createTrip(session, tripInput(company.id, { primaryDriverId: driver.id }))
    ).rejects.toThrow(InvalidTripError);
  });

  it("respinge un interval cu sfârșitul înaintea începutului", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(
      createTrip(session, tripInput(company.id, { startsAt: d("2026-09-05"), endsAt: d("2026-09-01") }))
    ).rejects.toThrow(InvalidTripError);
  });

  it("respinge crearea pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      createTrip({ role: "COMPANY_ADMIN", companyId: a.id }, tripInput(b.id))
    ).rejects.toThrow(TenantAccessError);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/trips.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/data/trips.ts`:

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { formatTripNumber } from "@/lib/tripStatus";
// Reused rather than duplicated: the helper is order-flavoured in name only —
// it returns the current calendar year in Europe/Bucharest, which is what trip
// numbering needs too.
import { currentOrderYear } from "@/lib/data/orders";

export class TripNotFoundError extends Error {
  constructor() {
    super("Cursa nu a fost găsită.");
    this.name = "TripNotFoundError";
  }
}

export class InvalidTripError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTripError";
  }
}

export class TripNumberingError extends Error {
  constructor() {
    super("Nu s-a putut aloca un număr de cursă. Încearcă din nou.");
    this.name = "TripNumberingError";
  }
}

export type TripResourceInput = {
  tractorUnitId?: string | null;
  trailerId?: string | null;
  primaryDriverId?: string | null;
  secondDriverId?: string | null;
};

export type CreateTripInput = TripResourceInput & {
  companyId: string;
  startsAt: Date;
  endsAt: Date;
  notes?: string | null;
};

// Mirrors the budget in lib/data/orders.ts: the advisory lock below is the real
// serialization, and the two unique constraints are the real guard. This retry
// is a defensive backstop.
export const MAX_TRIP_NUMBERING_ATTEMPTS = 3;

/**
 * Proves every supplied resource belongs to this company and is still active.
 * Inactive ones are rejected on the server, not merely hidden in the UI — a
 * stale page could otherwise assign a truck that was sold this morning.
 */
export async function assertResourcesUsable(
  companyId: string,
  input: TripResourceInput
): Promise<void> {
  const vehicleIds = [input.tractorUnitId, input.trailerId].filter(
    (id): id is string => Boolean(id)
  );
  const driverIds = [input.primaryDriverId, input.secondDriverId].filter(
    (id): id is string => Boolean(id)
  );

  if (
    input.primaryDriverId &&
    input.secondDriverId &&
    input.primaryDriverId === input.secondDriverId
  ) {
    throw new InvalidTripError("Cei doi șoferi nu pot fi aceeași persoană.");
  }

  if (input.tractorUnitId && input.tractorUnitId === input.trailerId) {
    throw new InvalidTripError("Capul tractor și semiremorca nu pot fi același vehicul.");
  }

  for (const id of vehicleIds) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.companyId !== companyId) {
      throw new InvalidTripError("Vehiculul selectat nu aparține firmei tale.");
    }
    if (!vehicle.isActive) {
      throw new InvalidTripError(`Vehiculul ${vehicle.registrationNumber} este dezactivat.`);
    }
  }

  for (const id of driverIds) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver || driver.companyId !== companyId) {
      throw new InvalidTripError("Șoferul selectat nu aparține firmei tale.");
    }
    if (!driver.isActive) {
      throw new InvalidTripError(`Șoferul ${driver.lastName} ${driver.firstName} este dezactivat.`);
    }
  }
}

function assertDateRangeValid(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() < startsAt.getTime()) {
    throw new InvalidTripError("Sfârșitul cursei nu poate fi înaintea începutului.");
  }
}

export async function createTrip(session: SessionUser, input: CreateTripInput) {
  assertCompanyAccess(session, input.companyId);
  assertDateRangeValid(input.startsAt, input.endsAt);
  await assertResourcesUsable(input.companyId, input);

  const year = currentOrderYear();

  for (let attempt = 0; attempt < MAX_TRIP_NUMBERING_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Transaction-scoped advisory lock, released on commit or rollback.
        // Serializes number allocation per (companyId, year) across every
        // connection, so concurrent callers queue instead of racing the
        // aggregate-then-insert below. Keyed on "trip:" so it cannot contend
        // with order numbering, which locks the same company and year.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trip:${input.companyId}:${year}`}))`;

        const highest = await tx.trip.aggregate({
          where: { companyId: input.companyId, year },
          _max: { sequence: true },
        });
        const sequence = (highest._max.sequence ?? 0) + 1;

        return tx.trip.create({
          data: {
            companyId: input.companyId,
            year,
            sequence,
            tripNumber: formatTripNumber(year, sequence),
            tractorUnitId: input.tractorUnitId ?? null,
            trailerId: input.trailerId ?? null,
            primaryDriverId: input.primaryDriverId ?? null,
            secondDriverId: input.secondDriverId ?? null,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            notes: input.notes ?? null,
          },
        });
      });
    } catch (error) {
      const isNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (isNumberCollision && attempt < MAX_TRIP_NUMBERING_ATTEMPTS - 1) continue;
      if (isNumberCollision) throw new TripNumberingError();

      // P2024 (pool wait timed out) and P2028 (transaction closed) are what
      // contention produces once the pool is saturated; without this they would
      // surface as raw English Prisma errors instead of the Romanian one.
      const isResourceExhaustion =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2024" || error.code === "P2028");
      if (isResourceExhaustion) throw new TripNumberingError();

      throw error;
    }
  }

  throw new TripNumberingError();
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/trips.ts tests/data/trips.test.ts
git commit -m "feat: add trip creation with per-company numbering"
```

---

## Task 4: Citirea curselor și detectarea suprapunerilor

**Files:**
- Modify: `lib/data/trips.ts`
- Test: `tests/data/tripConflicts.test.ts`

**Interfaces:**
- Consumes: everything from Task 3, plus `datesOverlap` (Task 2).
- Produces (appended to `lib/data/trips.ts`):
  - `listTrips(session, companyId, options?: { status?: TripStatus }): Promise<TripListItem[]>`
  - `getTripById(session, tripId): Promise<TripWithEverything | null>`
  - `updateTripResources(session, tripId, input: TripResourceInput): Promise<TripModel>`
  - `updateTripDates(session, tripId, startsAt: Date, endsAt: Date): Promise<TripModel>`
  - `findResourceConflicts(session, companyId, input: ConflictQuery): Promise<ResourceConflict[]>`
  - types `TripListItem`, `TripWithEverything`, `ConflictQuery`, `ResourceConflict`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/tripConflicts.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  createTrip,
  listTrips,
  getTripById,
  updateTripResources,
  updateTripDates,
  findResourceConflicts,
  InvalidTripError,
} from "@/lib/data/trips";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setup(name: string, cui: string) {
  const company = await prisma.company.create({ data: { name, cui } });
  const tractor = await prisma.vehicle.create({
    data: { companyId: company.id, registrationNumber: `B-1-${cui}`, type: "TRACTOR_UNIT" },
  });
  const driver = await prisma.driver.create({
    data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
  });
  return {
    company,
    tractor,
    driver,
    session: { role: "COMPANY_ADMIN" as const, companyId: company.id },
  };
}

describe("findResourceConflicts", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("semnalează un cap tractor deja ocupat în interval", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const existing = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-04"),
      endsAt: d("2026-09-08"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].tripNumber).toBe(existing.tripNumber);
    expect(conflicts[0].resource).toBe("tractorUnit");
  });

  it("semnalează suprapunerea și când cursele se ating într-o zi", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-05"),
      endsAt: d("2026-09-09"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(1);
  });

  it("nu semnalează curse consecutive", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-06"),
      endsAt: d("2026-09-09"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("ignoră cursele anulate", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const existing = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });
    await prisma.trip.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-02"),
      endsAt: d("2026-09-03"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("se exclude pe sine când se editează o cursă existentă", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
      excludeTripId: trip.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("semnalează un șofer ocupat, indiferent pe ce poziție era", async () => {
    const { company, driver, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      secondDriverId: driver.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-03"),
      endsAt: d("2026-09-07"),
      primaryDriverId: driver.id,
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resource).toBe("primaryDriver");
  });

  it("nu vede cursele altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    await createTrip(b.session, {
      companyId: b.company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: b.tractor.id,
    });

    const conflicts = await findResourceConflicts(a.session, a.company.id, {
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: b.tractor.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(
      findResourceConflicts(a.session, b.company.id, {
        startsAt: d("2026-09-01"),
        endsAt: d("2026-09-05"),
      })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listTrips și getTripById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar cursele firmei cerute", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    await createTrip(a.session, { companyId: a.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-02") });
    await createTrip(b.session, { companyId: b.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-02") });

    expect(await listTrips(a.session, a.company.id)).toHaveLength(1);
  });

  it("filtrează după stare", async () => {
    const a = await setup("Firma A", "RO1");
    await createTrip(a.session, { companyId: a.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-02") });

    expect(await listTrips(a.session, a.company.id, { status: "PLANNED" })).toHaveLength(1);
    expect(await listTrips(a.session, a.company.id, { status: "COMPLETED" })).toHaveLength(0);
  });

  it("returnează null pentru o cursă din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const tripB = await createTrip(b.session, {
      companyId: b.company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    expect(await getTripById(a.session, tripB.id)).toBeNull();
  });
});

describe("updateTripResources și updateTripDates", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("schimbă resursele alocate", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    const updated = await updateTripResources(session, trip.id, { tractorUnitId: tractor.id });

    expect(updated.tractorUnitId).toBe(tractor.id);
  });

  it("respinge modificarea unei curse din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const tripB = await createTrip(b.session, {
      companyId: b.company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    await expect(
      updateTripResources(a.session, tripB.id, { tractorUnitId: a.tractor.id })
    ).rejects.toThrow(TenantAccessError);
  });

  it("marchează intervalul ca editat manual, ca să nu mai fie recalculat", async () => {
    const { company, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    const updated = await updateTripDates(session, trip.id, d("2026-09-01"), d("2026-09-06"));

    expect(updated.datesEditedManually).toBe(true);
    expect(updated.endsAt.toISOString().slice(0, 10)).toBe("2026-09-06");
  });

  it("respinge un interval inversat", async () => {
    const { company, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    await expect(
      updateTripDates(session, trip.id, d("2026-09-05"), d("2026-09-01"))
    ).rejects.toThrow(InvalidTripError);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — funcțiile nu există în `lib/data/trips.ts`.

- [ ] **Step 3: Implementează — adaugă la finalul `lib/data/trips.ts`**

Add these imports to the TOP of `lib/data/trips.ts`, joining the existing ones:

```ts
import type { TripStatus } from "@/lib/generated/prisma/enums";
import { datesOverlap } from "@/lib/tripStatus";
```

Then append to the file:

```ts
export type TripListItem = Prisma.TripGetPayload<{
  include: {
    tractorUnit: { select: { registrationNumber: true } };
    trailer: { select: { registrationNumber: true } };
    primaryDriver: { select: { firstName: true; lastName: true } };
    secondDriver: { select: { firstName: true; lastName: true } };
    orders: { select: { id: true; orderNumber: true } };
  };
}>;

export type TripWithEverything = Prisma.TripGetPayload<{
  include: {
    tractorUnit: true;
    trailer: true;
    primaryDriver: true;
    secondDriver: true;
    orders: { include: { client: { select: { name: true } }; stops: true } };
  };
}>;

export type ConflictQuery = TripResourceInput & {
  startsAt: Date;
  endsAt: Date;
  excludeTripId?: string;
};

export type ResourceConflict = {
  tripId: string;
  tripNumber: string;
  resource: "tractorUnit" | "trailer" | "primaryDriver" | "secondDriver";
  resourceLabel: string;
};

const TRIP_LIST_INCLUDE = {
  tractorUnit: { select: { registrationNumber: true } },
  trailer: { select: { registrationNumber: true } },
  primaryDriver: { select: { firstName: true, lastName: true } },
  secondDriver: { select: { firstName: true, lastName: true } },
  orders: { select: { id: true, orderNumber: true } },
} as const;

export async function listTrips(
  session: SessionUser,
  companyId: string,
  options: { status?: TripStatus } = {}
): Promise<TripListItem[]> {
  assertCompanyAccess(session, companyId);

  return prisma.trip.findMany({
    where: { companyId, ...(options.status ? { status: options.status } : {}) },
    include: TRIP_LIST_INCLUDE,
    orderBy: [{ year: "desc" }, { sequence: "desc" }],
  });
}

export async function getTripById(
  session: SessionUser,
  tripId: string
): Promise<TripWithEverything | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      tractorUnit: true,
      trailer: true,
      primaryDriver: true,
      secondDriver: true,
      orders: { include: { client: { select: { name: true } }, stops: true } },
    },
  });
  if (!trip) return null;
  // Null rather than throw, so pages render 404 without revealing existence.
  if (trip.companyId !== session.companyId) return null;
  return trip;
}

async function assertOwnTrip(session: SessionUser, tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new TripNotFoundError();
  assertCompanyAccess(session, trip.companyId);
  return trip;
}

/**
 * Returns every clash rather than the first, so the dispatcher sees the whole
 * picture in one warning instead of fixing one and discovering the next.
 * A driver occupies the person in either seat, so both slots are checked
 * against both slots.
 */
export async function findResourceConflicts(
  session: SessionUser,
  companyId: string,
  input: ConflictQuery
): Promise<ResourceConflict[]> {
  assertCompanyAccess(session, companyId);

  const candidates = await prisma.trip.findMany({
    where: {
      companyId,
      status: { not: "CANCELLED" },
      ...(input.excludeTripId ? { id: { not: input.excludeTripId } } : {}),
    },
    include: TRIP_LIST_INCLUDE,
  });

  const conflicts: ResourceConflict[] = [];

  for (const trip of candidates) {
    if (!datesOverlap(input.startsAt, input.endsAt, trip.startsAt, trip.endsAt)) continue;

    if (input.tractorUnitId && trip.tractorUnitId === input.tractorUnitId) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "tractorUnit",
        resourceLabel: trip.tractorUnit?.registrationNumber ?? "vehicul",
      });
    }
    if (input.trailerId && trip.trailerId === input.trailerId) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "trailer",
        resourceLabel: trip.trailer?.registrationNumber ?? "semiremorcă",
      });
    }

    const busyDrivers = [trip.primaryDriverId, trip.secondDriverId].filter(Boolean);
    const driverLabel = (id: string) =>
      trip.primaryDriverId === id
        ? `${trip.primaryDriver?.lastName ?? ""} ${trip.primaryDriver?.firstName ?? ""}`.trim()
        : `${trip.secondDriver?.lastName ?? ""} ${trip.secondDriver?.firstName ?? ""}`.trim();

    if (input.primaryDriverId && busyDrivers.includes(input.primaryDriverId)) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "primaryDriver",
        resourceLabel: driverLabel(input.primaryDriverId) || "șofer",
      });
    }
    if (input.secondDriverId && busyDrivers.includes(input.secondDriverId)) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "secondDriver",
        resourceLabel: driverLabel(input.secondDriverId) || "șofer",
      });
    }
  }

  return conflicts;
}

export async function updateTripResources(
  session: SessionUser,
  tripId: string,
  input: TripResourceInput
) {
  const trip = await assertOwnTrip(session, tripId);

  // Only newly-assigned resources are validated. A truck sold after the trip was
  // planned must not make that trip uneditable — you still need to fix its dates
  // or swap the driver, and rejecting the unchanged truck would block everything.
  const changed: TripResourceInput = {
    tractorUnitId:
      input.tractorUnitId !== trip.tractorUnitId ? input.tractorUnitId : null,
    trailerId: input.trailerId !== trip.trailerId ? input.trailerId : null,
    primaryDriverId:
      input.primaryDriverId !== trip.primaryDriverId ? input.primaryDriverId : null,
    secondDriverId:
      input.secondDriverId !== trip.secondDriverId ? input.secondDriverId : null,
  };
  await assertResourcesUsable(trip.companyId, changed);

  return prisma.trip.update({
    where: { id: tripId },
    data: {
      tractorUnitId: input.tractorUnitId ?? null,
      trailerId: input.trailerId ?? null,
      primaryDriverId: input.primaryDriverId ?? null,
      secondDriverId: input.secondDriverId ?? null,
    },
  });
}

export async function updateTripDates(
  session: SessionUser,
  tripId: string,
  startsAt: Date,
  endsAt: Date
) {
  await assertOwnTrip(session, tripId);
  assertDateRangeValid(startsAt, endsAt);

  // Setting the flag is the point: from here on, attaching an order must not
  // silently overwrite what the dispatcher chose.
  return prisma.trip.update({
    where: { id: tripId },
    data: { startsAt, endsAt, datesEditedManually: true },
  });
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/trips.ts tests/data/tripConflicts.test.ts
git commit -m "feat: add trip reading, resource updates and overlap detection"
```

---

## Task 5: Atașarea comenzilor și recalcularea intervalului

**Files:**
- Modify: `lib/data/trips.ts`
- Test: `tests/data/tripOrders.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3-4.
- Produces (appended to `lib/data/trips.ts`):
  - `attachOrderToTrip(session, tripId, orderId): Promise<void>`
  - `detachOrderFromTrip(session, orderId): Promise<void>`
  - `listUnplannedOrders(session, companyId): Promise<UnplannedOrder[]>`
  - type `UnplannedOrder`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/tripOrders.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createTrip, getTripById, InvalidTripError } from "@/lib/data/trips";
import {
  attachOrderToTrip,
  detachOrderFromTrip,
  listUnplannedOrders,
} from "@/lib/data/trips";
import { createOrder } from "@/lib/data/orders";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setup(name: string, cui: string) {
  const company = await prisma.company.create({ data: { name, cui } });
  const client = await prisma.client.create({
    data: { companyId: company.id, name: "Client", cui: `${cui}-C`, address: "A", city: "B" },
  });
  const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
  return { company, client, session };
}

async function makeOrder(
  session: { role: "COMPANY_ADMIN"; companyId: string },
  companyId: string,
  clientId: string,
  loading: string,
  unloading: string
) {
  return createOrder(session, {
    companyId,
    clientId,
    clientReference: `REF-${loading}`,
    cargoDescription: "Marfă",
    salePrice: "1000.00",
    currency: "RON",
    paymentTermDays: 45,
    stops: [
      { type: "LOADING", address: "A", city: "X", scheduledDate: d(loading) },
      { type: "UNLOADING", address: "B", city: "Y", scheduledDate: d(unloading) },
    ],
  });
}

describe("attachOrderToTrip", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("atașează o comandă confirmată și recalculează intervalul", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await attachOrderToTrip(session, trip.id, order.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.orders).toHaveLength(1);
    expect(fresh!.startsAt.toISOString().slice(0, 10)).toBe("2026-09-03");
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-07");
  });

  it("nu recalculează intervalul dacă a fost editat manual", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-20"),
    });
    await prisma.trip.update({ where: { id: trip.id }, data: { datesEditedManually: true } });

    await attachOrderToTrip(session, trip.id, order.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-20");
  });

  it("întinde intervalul peste mai multe comenzi", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const first = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-05");
    const second = await makeOrder(session, company.id, client.id, "2026-09-02", "2026-09-09");
    await prisma.order.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { status: "CONFIRMED" },
    });
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await attachOrderToTrip(session, trip.id, first.id);
    await attachOrderToTrip(session, trip.id, second.id);

    const fresh = await getTripById(session, trip.id);
    expect(fresh!.startsAt.toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(fresh!.endsAt.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("respinge o comandă care nu e confirmată", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-01"),
    });

    await expect(attachOrderToTrip(session, trip.id, order.id)).rejects.toThrow(InvalidTripError);
  });

  it("respinge o comandă deja atașată altei curse", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const first = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    const second = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, first.id, order.id);

    await expect(attachOrderToTrip(session, second.id, order.id)).rejects.toThrow(InvalidTripError);
  });

  it("respinge o comandă a altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const orderB = await makeOrder(b.session, b.company.id, b.client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: orderB.id }, data: { status: "CONFIRMED" } });
    const tripA = await createTrip(a.session, { companyId: a.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });

    await expect(attachOrderToTrip(a.session, tripA.id, orderB.id)).rejects.toThrow(
      InvalidTripError
    );
  });

  it("respinge atașarea la o cursă încheiată", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "COMPLETED" } });

    await expect(attachOrderToTrip(session, trip.id, order.id)).rejects.toThrow(InvalidTripError);
  });

  it("respinge o cursă a altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const orderA = await makeOrder(a.session, a.company.id, a.client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: orderA.id }, data: { status: "CONFIRMED" } });
    const tripB = await createTrip(b.session, { companyId: b.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });

    await expect(attachOrderToTrip(a.session, tripB.id, orderA.id)).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("detachOrderFromTrip", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("desprinde comanda fără să-i schimbe starea", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const order = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-07");
    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, trip.id, order.id);

    await detachOrderFromTrip(session, order.id);

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.tripId).toBeNull();
    expect(fresh.status).toBe("CONFIRMED");
  });

  it("respinge desprinderea unei comenzi din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const orderB = await makeOrder(b.session, b.company.id, b.client.id, "2026-09-03", "2026-09-07");

    await expect(detachOrderFromTrip(a.session, orderB.id)).rejects.toThrow(TenantAccessError);
  });
});

describe("listUnplannedOrders", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar comenzile confirmate fără cursă", async () => {
    const { company, client, session } = await setup("Firma A", "RO1");
    const planned = await makeOrder(session, company.id, client.id, "2026-09-03", "2026-09-05");
    const unplanned = await makeOrder(session, company.id, client.id, "2026-09-04", "2026-09-06");
    const notConfirmed = await makeOrder(session, company.id, client.id, "2026-09-05", "2026-09-07");
    await prisma.order.updateMany({
      where: { id: { in: [planned.id, unplanned.id] } },
      data: { status: "CONFIRMED" },
    });
    const trip = await createTrip(session, { companyId: company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-01") });
    await attachOrderToTrip(session, trip.id, planned.id);

    const result = await listUnplannedOrders(session, company.id);

    expect(result.map((o) => o.id)).toEqual([unplanned.id]);
    expect(result.map((o) => o.id)).not.toContain(notConfirmed.id);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(listUnplannedOrders(a.session, b.company.id)).rejects.toThrow(TenantAccessError);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — funcțiile nu există.

- [ ] **Step 3: Implementează — adaugă la finalul `lib/data/trips.ts`**

Add this import to the TOP of the file, joining the existing ones:

```ts
import { TRIP_EDITABLE_STATUSES } from "@/lib/tripStatus";
```

Then append:

```ts
export type UnplannedOrder = Prisma.OrderGetPayload<{
  include: { client: { select: { name: true } }; stops: true };
}>;

/**
 * Recomputes the trip's window from its orders' stops, unless the dispatcher
 * has taken the dates over by hand. Called inside the same transaction as the
 * attach/detach, so the window is never observed out of step with its orders.
 */
async function recalcTripDates(
  tx: Prisma.TransactionClient,
  tripId: string
): Promise<void> {
  const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } });
  if (trip.datesEditedManually) return;

  const stops = await tx.orderStop.findMany({
    where: { order: { tripId } },
    select: { type: true, scheduledDate: true },
  });
  if (stops.length === 0) return;

  const loadings = stops.filter((s) => s.type === "LOADING").map((s) => s.scheduledDate.getTime());
  const unloadings = stops
    .filter((s) => s.type === "UNLOADING")
    .map((s) => s.scheduledDate.getTime());

  // Every order carries at least one of each, guaranteed by order creation, so
  // these arrays are non-empty whenever any stop exists.
  const startsAt = new Date(Math.min(...loadings));
  const endsAt = new Date(Math.max(...unloadings));

  await tx.trip.update({ where: { id: tripId }, data: { startsAt, endsAt } });
}

export async function attachOrderToTrip(
  session: SessionUser,
  tripId: string,
  orderId: string
): Promise<void> {
  const trip = await assertOwnTrip(session, tripId);

  if (!(TRIP_EDITABLE_STATUSES as readonly string[]).includes(trip.status)) {
    throw new InvalidTripError("Cursa este încheiată sau anulată și nu mai poate fi modificată.");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.companyId !== trip.companyId) {
    throw new InvalidTripError("Comanda selectată nu aparține firmei tale.");
  }
  if (order.status !== "CONFIRMED") {
    throw new InvalidTripError("Doar comenzile confirmate pot fi planificate.");
  }
  if (order.tripId) {
    throw new InvalidTripError("Comanda este deja atașată unei curse.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { tripId } });
    await recalcTripDates(tx, tripId);
  });
}

export async function detachOrderFromTrip(
  session: SessionUser,
  orderId: string
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new TripNotFoundError();
  assertCompanyAccess(session, order.companyId);

  const tripId = order.tripId;
  if (!tripId) return;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { tripId: null } });
    await recalcTripDates(tx, tripId);
  });
}

export async function listUnplannedOrders(
  session: SessionUser,
  companyId: string
): Promise<UnplannedOrder[]> {
  assertCompanyAccess(session, companyId);

  return prisma.order.findMany({
    where: { companyId, tripId: null, status: "CONFIRMED" },
    include: { client: { select: { name: true } }, stops: { orderBy: { sequence: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/trips.ts tests/data/tripOrders.test.ts
git commit -m "feat: attach and detach orders, recalculating the trip window"
```

---

## Task 6: Stările cursei și propagarea către comenzi

**Files:**
- Modify: `lib/data/trips.ts`, `lib/data/orders.ts`
- Test: `tests/data/tripStatusPropagation.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3-5, plus `assertTripTransitionAllowed` (Task 2).
- Produces:
  - `updateTripStatus(session, tripId, to: TripStatus): Promise<TripModel>` from `lib/data/trips.ts`
  - modified `updateOrderStatus` in `lib/data/orders.ts` — cancelling an order also detaches it

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/tripStatusPropagation.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createTrip, attachOrderToTrip, updateTripStatus } from "@/lib/data/trips";
import { createOrder, updateOrderStatus } from "@/lib/data/orders";
import { InvalidTripStatusTransitionError } from "@/lib/tripStatus";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setupWithOrder(name: string, cui: string) {
  const company = await prisma.company.create({ data: { name, cui } });
  const client = await prisma.client.create({
    data: { companyId: company.id, name: "Client", cui: `${cui}-C`, address: "A", city: "B" },
  });
  const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

  const order = await createOrder(session, {
    companyId: company.id,
    clientId: client.id,
    clientReference: "REF-1",
    cargoDescription: "Marfă",
    salePrice: "1000.00",
    currency: "RON",
    paymentTermDays: 45,
    stops: [
      { type: "LOADING", address: "A", city: "X", scheduledDate: d("2026-09-03") },
      { type: "UNLOADING", address: "B", city: "Y", scheduledDate: d("2026-09-05") },
    ],
  });
  await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });

  const trip = await createTrip(session, {
    companyId: company.id,
    startsAt: d("2026-09-01"),
    endsAt: d("2026-09-01"),
  });
  await attachOrderToTrip(session, trip.id, order.id);

  return { company, client, session, order, trip };
}

describe("updateTripStatus", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("pornirea cursei mută comenzile confirmate în execuție", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");

    await updateTripStatus(session, trip.id, "IN_PROGRESS");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("IN_PROGRESS");
  });

  it("încheierea cursei mută comenzile în livrate", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");
    await updateTripStatus(session, trip.id, "IN_PROGRESS");

    await updateTripStatus(session, trip.id, "COMPLETED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("DELIVERED");
  });

  it("nu dă înapoi o comandă care a avansat deja singură", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");
    await updateTripStatus(session, trip.id, "IN_PROGRESS");
    // The order raced ahead on its own: delivered, documents in, invoiced.
    await updateOrderStatus(session, order.id, "DELIVERED");
    await updateOrderStatus(session, order.id, "DOCUMENTS_RECEIVED");
    await updateOrderStatus(session, order.id, "INVOICED");

    await updateTripStatus(session, trip.id, "COMPLETED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("INVOICED");
  });

  it("anularea cursei desprinde comenzile fără să le schimbe starea", async () => {
    const { session, trip, order } = await setupWithOrder("Firma A", "RO1");

    await updateTripStatus(session, trip.id, "CANCELLED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.tripId).toBeNull();
    expect(fresh.status).toBe("CONFIRMED");
  });

  it("respinge o tranziție nepermisă", async () => {
    const { session, trip } = await setupWithOrder("Firma A", "RO1");

    await expect(updateTripStatus(session, trip.id, "COMPLETED")).rejects.toThrow(
      InvalidTripStatusTransitionError
    );
  });

  it("respinge schimbarea stării unei curse din altă firmă", async () => {
    const a = await setupWithOrder("Firma A", "RO1");
    const b = await setupWithOrder("Firma B", "RO2");

    await expect(updateTripStatus(a.session, b.trip.id, "IN_PROGRESS")).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("anularea unei comenzi o desprinde din cursă", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("scoate comanda anulată din cursa ei", async () => {
    const { session, order } = await setupWithOrder("Firma A", "RO1");

    await updateOrderStatus(session, order.id, "CANCELLED");

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("CANCELLED");
    expect(fresh.tripId).toBeNull();
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `updateTripStatus` nu există.

- [ ] **Step 3: Implementează propagarea în `lib/data/trips.ts`**

Add this import to the TOP of `lib/data/trips.ts`, joining the existing ones:

```ts
import { assertTripTransitionAllowed } from "@/lib/tripStatus";
```

Then append to the file:

```ts
/**
 * Propagation only ever advances an order along its own path. `updateMany` with
 * a status filter is what enforces that: an order that has already moved past
 * the expected state simply does not match, so a completed trip cannot pull an
 * invoiced order back to delivered.
 */
export async function updateTripStatus(
  session: SessionUser,
  tripId: string,
  to: TripStatus
) {
  const trip = await assertOwnTrip(session, tripId);
  assertTripTransitionAllowed(trip.status, to);

  return prisma.$transaction(async (tx) => {
    if (to === "IN_PROGRESS") {
      await tx.order.updateMany({
        where: { tripId, status: "CONFIRMED" },
        data: { status: "IN_PROGRESS" },
      });
    }
    if (to === "COMPLETED") {
      await tx.order.updateMany({
        where: { tripId, status: "IN_PROGRESS" },
        data: { status: "DELIVERED" },
      });
    }
    if (to === "CANCELLED") {
      // The orders themselves are untouched — they go back to the unplanned
      // list and can be put on another truck.
      await tx.order.updateMany({ where: { tripId }, data: { tripId: null } });
    }

    return tx.trip.update({ where: { id: tripId }, data: { status: to } });
  });
}
```

- [ ] **Step 4: Desprinde automat o comandă anulată**

Modify `lib/data/orders.ts` — in `updateOrderStatus`, replace the `data` object of the `prisma.order.update` call so cancelling also clears the trip link:

```ts
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: to,
      ...(to === "DOCUMENTS_RECEIVED" && !order.documentsReceivedAt
        ? { documentsReceivedAt: new Date() }
        : {}),
      // A cancelled order must not keep occupying a truck: it leaves the trip
      // as soon as it is cancelled, from wherever the cancellation came.
      ...(to === "CANCELLED" ? { tripId: null } : {}),
    },
  });
```

- [ ] **Step 5: Rulează testele, confirmă succesul**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/data/trips.ts lib/data/orders.ts tests/data/tripStatusPropagation.test.ts
git commit -m "feat: propagate trip status to its orders"
```

---

## Task 7: Ecranul de dispecerat

**Files:**
- Create: `app/dashboard/dispecerat/page.tsx`
- Modify: `components/app-shell.tsx`
- Create: `components/trip-status-badge.tsx`

**Interfaces:**
- Consumes: `listTrips`, `listUnplannedOrders` (Tasks 4-5); `TRIP_STATUS_LABELS` (Task 2).
- Produces: `TripStatusBadge`, reused by Task 8.

- [ ] **Step 1: Adaugă intrarea în meniul lateral**

Modify `components/app-shell.tsx` — replace the `COMPANY_NAV` constant:

```ts
const COMPANY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/dispecerat", label: "Dispecerat" },
  { href: "/dashboard/comenzi", label: "Comenzi" },
  { href: "/dashboard/clienti", label: "Clienți" },
  { href: "/dashboard/flota", label: "Flotă" },
  { href: "/dashboard/soferi", label: "Șoferi" },
  { href: "/dashboard/echipa", label: "Echipă", roles: ["COMPANY_ADMIN"] },
];
```

- [ ] **Step 2: Insigna de stare**

Write `components/trip-status-badge.tsx`:

```tsx
import { TRIP_STATUS_LABELS } from "@/lib/tripStatus";
import type { TripStatus } from "@/lib/generated/prisma/enums";

const CLASSES: Record<TripStatus, string> = {
  PLANNED: "bg-sky-100 text-sky-900 border-sky-300",
  IN_PROGRESS: "bg-amber-100 text-amber-900 border-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-900 border-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${CLASSES[status]}`}
    >
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 3: Pagina de dispecerat**

Write `app/dashboard/dispecerat/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { listTrips, listUnplannedOrders } from "@/lib/data/trips";
import { TRIP_STATUS_LABELS } from "@/lib/tripStatus";
import type { TripStatus } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";

const STATUS_VALUES = Object.keys(TRIP_STATUS_LABELS) as TripStatus[];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeZone: "UTC" }).format(date);
}

export default async function DispeceratPage({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string }>;
}) {
  const { stare } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;

  const status = STATUS_VALUES.includes(stare as TripStatus) ? (stare as TripStatus) : undefined;

  const [unplanned, trips] = await Promise.all([
    listUnplannedOrders(sessionUser, companyId),
    listTrips(sessionUser, companyId, { status }),
  ]);

  return (
    <div>
      <PageHeader
        title="Dispecerat"
        description="Comenzile care așteaptă un camion și cursele formate."
        actions={
          <Link href="/dashboard/curse/noua" className={buttonVariants()}>
            Cursă nouă
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium">
            Comenzi neplanificate ({unplanned.length})
          </h2>
          {unplanned.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Nicio comandă confirmată care să aștepte un camion.
            </p>
          ) : (
            <ul className="space-y-2">
              {unplanned.map((order) => {
                const first = order.stops[0];
                const last = order.stops[order.stops.length - 1];
                return (
                  <li key={order.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/dashboard/comenzi/${order.id}`} className="font-medium underline">
                        {order.orderNumber}
                      </Link>
                      <Link
                        href={`/dashboard/curse/noua?comanda=${order.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Planifică
                      </Link>
                    </div>
                    <p className="text-muted-foreground mt-1">{order.client.name}</p>
                    {first && last && (
                      <p className="text-muted-foreground">
                        {first.city} → {last.city} · {formatDate(first.scheduledDate)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Curse ({trips.length})</h2>
            <form>
              <select
                name="stare"
                defaultValue={stare ?? ""}
                className="rounded-lg border px-2 py-1 text-sm"
              >
                <option value="">Toate stările</option>
                {STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {TRIP_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm" className="ml-2">
                Filtrează
              </Button>
            </form>
          </div>

          {trips.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Nicio cursă.
            </p>
          ) : (
            <ul className="space-y-2">
              {trips.map((trip) => (
                <li key={trip.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/dashboard/curse/${trip.id}`} className="font-medium underline">
                      {trip.tripNumber}
                    </Link>
                    <TripStatusBadge status={trip.status} />
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {formatDate(trip.startsAt)} – {formatDate(trip.endsAt)}
                  </p>
                  <p className="text-muted-foreground">
                    {trip.tractorUnit?.registrationNumber ?? "fără camion"}
                    {trip.trailer && ` + ${trip.trailer.registrationNumber}`}
                    {trip.primaryDriver &&
                      ` · ${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`}
                  </p>
                  <p className="text-muted-foreground">
                    {trip.orders.length === 0
                      ? "fără comenzi"
                      : trip.orders.map((o) => o.orderNumber).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/dispecerat components/app-shell.tsx components/trip-status-badge.tsx
git commit -m "feat: add the dispatch board"
```

---

## Task 8: Fișa cursei și crearea cursei

**Files:**
- Create: `app/dashboard/curse/actions.ts`, `app/dashboard/curse/noua/page.tsx`, `app/dashboard/curse/noua/new-trip-form.tsx`, `app/dashboard/curse/[id]/page.tsx`, `app/dashboard/curse/[id]/resources-form.tsx`, `app/dashboard/curse/[id]/trip-orders.tsx`, `app/dashboard/curse/[id]/trip-status-actions.tsx`
- Modify: `app/dashboard/comenzi/[id]/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3-6; `TripStatusBadge` (Task 7); `listVehicles` from `lib/data/vehicles.ts`; `listDrivers` from `lib/data/drivers.ts`.

- [ ] **Step 1: Server actions**

Write `app/dashboard/curse/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createTrip,
  updateTripResources,
  updateTripDates,
  updateTripStatus,
  attachOrderToTrip,
  detachOrderFromTrip,
  findResourceConflicts,
  InvalidTripError,
  TripNotFoundError,
  TripNumberingError,
  type ResourceConflict,
} from "@/lib/data/trips";
import { InvalidTripStatusTransitionError } from "@/lib/tripStatus";
import { TenantAccessError } from "@/lib/tenancy";
import type { TripStatus } from "@/lib/generated/prisma/enums";

export type TripFormState = {
  error: string | null;
  /** Populated when a resource is already busy; the user may submit again to accept. */
  conflicts: ResourceConflict[];
};

function readResources(formData: FormData) {
  return {
    tractorUnitId: (formData.get("tractorUnitId") as string) || null,
    trailerId: (formData.get("trailerId") as string) || null,
    primaryDriverId: (formData.get("primaryDriverId") as string) || null,
    secondDriverId: (formData.get("secondDriverId") as string) || null,
  };
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const text = value as string;
  if (!text) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  // An unparsable date yields an Invalid Date object, which is truthy — without
  // this check it would sail past the caller's `if (!date)` guard into Prisma.
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function createTripAction(
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const sessionUser = { role: session.user.role, companyId: session.user.companyId };
  const companyId = session.user.companyId;

  const startsAt = parseDate(formData.get("startsAt"));
  const endsAt = parseDate(formData.get("endsAt"));
  if (!startsAt || !endsAt) {
    return { error: "Ambele date ale cursei sunt obligatorii.", conflicts: [] };
  }

  const resources = readResources(formData);
  const accepted = formData.get("acceptConflicts") === "true";

  if (!accepted) {
    const conflicts = await findResourceConflicts(sessionUser, companyId, {
      startsAt,
      endsAt,
      ...resources,
    });
    if (conflicts.length > 0) return { error: null, conflicts };
  }

  let tripId: string;
  try {
    const trip = await createTrip(sessionUser, {
      companyId,
      startsAt,
      endsAt,
      ...resources,
      notes: (formData.get("notes") as string) || null,
    });
    tripId = trip.id;
  } catch (error) {
    if (error instanceof InvalidTripError || error instanceof TripNumberingError) {
      return { error: error.message, conflicts: [] };
    }
    throw error;
  }

  const orderId = formData.get("orderId") as string;
  if (orderId) {
    try {
      await attachOrderToTrip(sessionUser, tripId, orderId);
    } catch (error) {
      if (error instanceof InvalidTripError) {
        // The trip exists; only the attach failed. Sending the user to it beats
        // losing the trip they just created.
        revalidatePath("/dashboard/dispecerat");
        redirect(`/dashboard/curse/${tripId}`);
      }
      throw error;
    }
  }

  revalidatePath("/dashboard/dispecerat");
  redirect(`/dashboard/curse/${tripId}`);
}

export async function updateTripResourcesAction(
  tripId: string,
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const sessionUser = { role: session.user.role, companyId: session.user.companyId };
  const resources = readResources(formData);
  const accepted = formData.get("acceptConflicts") === "true";

  const startsAt = parseDate(formData.get("startsAt"));
  const endsAt = parseDate(formData.get("endsAt"));
  if (!startsAt || !endsAt) {
    return { error: "Ambele date ale cursei sunt obligatorii.", conflicts: [] };
  }

  if (!accepted) {
    const conflicts = await findResourceConflicts(sessionUser, session.user.companyId, {
      startsAt,
      endsAt,
      ...resources,
      excludeTripId: tripId,
    });
    if (conflicts.length > 0) return { error: null, conflicts };
  }

  try {
    await updateTripResources(sessionUser, tripId, resources);
    if (formData.get("datesChanged") === "true") {
      await updateTripDates(sessionUser, tripId, startsAt, endsAt);
    }
  } catch (error) {
    if (error instanceof InvalidTripError) return { error: error.message, conflicts: [] };
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof TripNotFoundError || error instanceof TenantAccessError) {
      return { error: new TripNotFoundError().message, conflicts: [] };
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
  return { error: null, conflicts: [] };
}

export async function updateTripStatusAction(tripId: string, to: TripStatus) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateTripStatus(
      { role: session.user.role, companyId: session.user.companyId },
      tripId,
      to
    );
  } catch (error) {
    if (
      error instanceof InvalidTripStatusTransitionError ||
      error instanceof TripNotFoundError ||
      error instanceof TenantAccessError
    ) {
      // Buttons only offer allowed transitions, so this means a stale page.
      revalidatePath(`/dashboard/curse/${tripId}`);
      return;
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
  revalidatePath("/dashboard/comenzi");
}

export async function attachOrderAction(
  tripId: string,
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const orderId = formData.get("orderId") as string;
  if (!orderId) return { error: "Alege o comandă.", conflicts: [] };

  try {
    await attachOrderToTrip(
      { role: session.user.role, companyId: session.user.companyId },
      tripId,
      orderId
    );
  } catch (error) {
    if (error instanceof InvalidTripError) return { error: error.message, conflicts: [] };
    if (error instanceof TripNotFoundError || error instanceof TenantAccessError) {
      return { error: new TripNotFoundError().message, conflicts: [] };
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
  return { error: null, conflicts: [] };
}

export async function detachOrderAction(orderId: string, tripId: string) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await detachOrderFromTrip(
      { role: session.user.role, companyId: session.user.companyId },
      orderId
    );
  } catch (error) {
    if (error instanceof TripNotFoundError || error instanceof TenantAccessError) {
      revalidatePath(`/dashboard/curse/${tripId}`);
      return;
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
}
```

- [ ] **Step 2: Formularul de cursă nouă**

Write `app/dashboard/curse/noua/new-trip-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTripAction, type TripFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ResourceOption = { id: string; label: string };

export function NewTripForm({
  tractorUnits,
  trailers,
  drivers,
  orderId,
  defaultStartsAt,
  defaultEndsAt,
}: {
  tractorUnits: ResourceOption[];
  trailers: ResourceOption[];
  drivers: ResourceOption[];
  orderId?: string;
  defaultStartsAt: string;
  defaultEndsAt: string;
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
    notes: "",
  });

  // A <select>'s value prop is unchanged across the failed-submit render, so
  // React's diff never restores what the native reset clobbered. These refs put
  // it back.
  const tractorRef = useRef<HTMLSelectElement>(null);
  const trailerRef = useRef<HTMLSelectElement>(null);
  const primaryRef = useRef<HTMLSelectElement>(null);
  const secondRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (tractorRef.current) tractorRef.current.value = fields.tractorUnitId;
    if (trailerRef.current) trailerRef.current.value = fields.trailerId;
    if (primaryRef.current) primaryRef.current.value = fields.primaryDriverId;
    if (secondRef.current) secondRef.current.value = fields.secondDriverId;
  }, [state, fields]);

  function update<K extends keyof typeof fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      {/* Set once the user has seen the warning: the next submit goes through. */}
      {state.conflicts.length > 0 && (
        <input type="hidden" name="acceptConflicts" value="true" />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="startsAt">Început</Label>
        <Input
          id="startsAt"
          name="startsAt"
          type="date"
          value={fields.startsAt}
          onChange={(e) => update("startsAt", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endsAt">Sfârșit</Label>
        <Input
          id="endsAt"
          name="endsAt"
          type="date"
          value={fields.endsAt}
          onChange={(e) => update("endsAt", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tractorUnitId">Cap tractor</Label>
        <select
          id="tractorUnitId"
          name="tractorUnitId"
          ref={tractorRef}
          value={fields.tractorUnitId}
          onChange={(e) => update("tractorUnitId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {tractorUnits.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trailerId">Semiremorcă</Label>
        <select
          id="trailerId"
          name="trailerId"
          ref={trailerRef}
          value={fields.trailerId}
          onChange={(e) => update("trailerId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciuna —</option>
          {trailers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="primaryDriverId">Șofer principal</Label>
        <select
          id="primaryDriverId"
          name="primaryDriverId"
          ref={primaryRef}
          value={fields.primaryDriverId}
          onChange={(e) => update("primaryDriverId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {drivers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secondDriverId">Al doilea șofer</Label>
        <select
          id="secondDriverId"
          name="secondDriverId"
          ref={secondRef}
          value={fields.secondDriverId}
          onChange={(e) => update("secondDriverId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {drivers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Observații</Label>
        <Input
          id="notes"
          name="notes"
          value={fields.notes}
          onChange={(e) => update("notes", e.target.value)}
        />
      </div>

      {state.conflicts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          <p className="font-medium">Resurse deja ocupate în acest interval:</p>
          <ul className="list-inside list-disc">
            {state.conflicts.map((c, i) => (
              <li key={i}>
                {c.resourceLabel} — cursa {c.tripNumber}
              </li>
            ))}
          </ul>
          <p>Apasă din nou pe buton dacă vrei să continui oricum.</p>
        </div>
      )}
      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : "Creează cursa"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Pagina de cursă nouă**

Write `app/dashboard/curse/noua/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { listVehicles } from "@/lib/data/vehicles";
import { listDrivers } from "@/lib/data/drivers";
import { getOrderById } from "@/lib/data/orders";
import { toDateKey } from "@/lib/documentStatus";
import { PageHeader } from "@/components/page-header";
import { NewTripForm } from "./new-trip-form";

export default async function CursaNouaPage({
  searchParams,
}: {
  searchParams: Promise<{ comanda?: string }>;
}) {
  const { comanda } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;

  const [vehicles, drivers] = await Promise.all([
    listVehicles(sessionUser, companyId),
    listDrivers(sessionUser, companyId),
  ]);

  // Seeding the dates from the order saves the dispatcher retyping what the
  // stops already say.
  const order = comanda ? await getOrderById(sessionUser, comanda) : null;
  const loadingDates = order?.stops.filter((s) => s.type === "LOADING") ?? [];
  const unloadingDates = order?.stops.filter((s) => s.type === "UNLOADING") ?? [];
  const today = toDateKey(new Date());

  const defaultStartsAt =
    loadingDates.length > 0
      ? toDateKey(new Date(Math.min(...loadingDates.map((s) => s.scheduledDate.getTime()))))
      : today;
  const defaultEndsAt =
    unloadingDates.length > 0
      ? toDateKey(new Date(Math.max(...unloadingDates.map((s) => s.scheduledDate.getTime()))))
      : today;

  return (
    <div>
      <Link
        href="/dashboard/dispecerat"
        className="text-muted-foreground mb-4 inline-block text-sm underline"
      >
        ← Înapoi la dispecerat
      </Link>
      <PageHeader
        title="Cursă nouă"
        description={order ? `Se planifică comanda ${order.orderNumber}.` : undefined}
      />

      <NewTripForm
        tractorUnits={vehicles
          .filter((v) => v.type !== "SEMI_TRAILER")
          .map((v) => ({ id: v.id, label: v.registrationNumber }))}
        trailers={vehicles
          .filter((v) => v.type === "SEMI_TRAILER")
          .map((v) => ({ id: v.id, label: v.registrationNumber }))}
        drivers={drivers.map((d) => ({ id: d.id, label: `${d.lastName} ${d.firstName}` }))}
        orderId={order?.id}
        defaultStartsAt={defaultStartsAt}
        defaultEndsAt={defaultEndsAt}
      />
    </div>
  );
}
```

- [ ] **Step 4: Butoanele de stare**

Write `app/dashboard/curse/[id]/trip-status-actions.tsx`:

```tsx
"use client";

import { useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const nextStates = ALLOWED_TRIP_TRANSITIONS[status];

  if (nextStates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Cursa este în stare finală — nu mai poate fi schimbată.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStates.map((next) => (
        <Button
          key={next}
          type="button"
          size="sm"
          disabled={pending}
          variant={next === "CANCELLED" ? "destructive" : "default"}
          onClick={() => {
            if (next === "CANCELLED") {
              // Cancelling is terminal and detaches every order — worth a pause.
              if (!window.confirm("Anulezi cursa? Comenzile ei revin la neplanificate.")) return;
            }
            startTransition(() => {
              updateTripStatusAction(tripId, next);
            });
          }}
        >
          {next === "CANCELLED" ? "Anulează cursa" : `Marchează: ${TRIP_STATUS_LABELS[next]}`}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Secțiunea de comenzi a cursei**

Write `app/dashboard/curse/[id]/trip-orders.tsx`:

```tsx
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
```

- [ ] **Step 6: Formularul de resurse**

Write `app/dashboard/curse/[id]/resources-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTripResourcesAction, type TripFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceOption } from "../noua/new-trip-form";

export function TripResourcesForm({
  tripId,
  tractorUnits,
  trailers,
  drivers,
  values,
}: {
  tripId: string;
  tractorUnits: ResourceOption[];
  trailers: ResourceOption[];
  drivers: ResourceOption[];
  values: {
    startsAt: string;
    endsAt: string;
    tractorUnitId: string;
    trailerId: string;
    primaryDriverId: string;
    secondDriverId: string;
  };
}) {
  const boundAction = updateTripResourcesAction.bind(null, tripId);
  const [state, formAction, pending] = useActionState<TripFormState, FormData>(boundAction, {
    error: null,
    conflicts: [],
  });

  const [fields, setFields] = useState(values);
  const [datesChanged, setDatesChanged] = useState(false);

  const tractorRef = useRef<HTMLSelectElement>(null);
  const trailerRef = useRef<HTMLSelectElement>(null);
  const primaryRef = useRef<HTMLSelectElement>(null);
  const secondRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (tractorRef.current) tractorRef.current.value = fields.tractorUnitId;
    if (trailerRef.current) trailerRef.current.value = fields.trailerId;
    if (primaryRef.current) primaryRef.current.value = fields.primaryDriverId;
    if (secondRef.current) secondRef.current.value = fields.secondDriverId;
  }, [state, fields]);

  function update<K extends keyof typeof fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (key === "startsAt" || key === "endsAt") setDatesChanged(true);
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {state.conflicts.length > 0 && <input type="hidden" name="acceptConflicts" value="true" />}
      {/* Only a deliberate edit pins the dates; otherwise attaching an order may
          keep recalculating them. */}
      <input type="hidden" name="datesChanged" value={datesChanged ? "true" : "false"} />

      <div className="space-y-1.5">
        <Label htmlFor="startsAt">Început</Label>
        <Input
          id="startsAt"
          name="startsAt"
          type="date"
          value={fields.startsAt}
          onChange={(e) => update("startsAt", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endsAt">Sfârșit</Label>
        <Input
          id="endsAt"
          name="endsAt"
          type="date"
          value={fields.endsAt}
          onChange={(e) => update("endsAt", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tractorUnitId">Cap tractor</Label>
        <select
          id="tractorUnitId"
          name="tractorUnitId"
          ref={tractorRef}
          value={fields.tractorUnitId}
          onChange={(e) => update("tractorUnitId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {tractorUnits.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trailerId">Semiremorcă</Label>
        <select
          id="trailerId"
          name="trailerId"
          ref={trailerRef}
          value={fields.trailerId}
          onChange={(e) => update("trailerId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciuna —</option>
          {trailers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="primaryDriverId">Șofer principal</Label>
        <select
          id="primaryDriverId"
          name="primaryDriverId"
          ref={primaryRef}
          value={fields.primaryDriverId}
          onChange={(e) => update("primaryDriverId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {drivers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secondDriverId">Al doilea șofer</Label>
        <select
          id="secondDriverId"
          name="secondDriverId"
          ref={secondRef}
          value={fields.secondDriverId}
          onChange={(e) => update("secondDriverId", e.target.value)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">— niciunul —</option>
          {drivers.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {state.conflicts.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          <p className="font-medium">Resurse deja ocupate în acest interval:</p>
          <ul className="list-inside list-disc">
            {state.conflicts.map((c, i) => (
              <li key={i}>
                {c.resourceLabel} — cursa {c.tripNumber}
              </li>
            ))}
          </ul>
          <p>Apasă din nou pe buton dacă vrei să continui oricum.</p>
        </div>
      )}
      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : "Salvează alocarea"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Fișa cursei**

Write `app/dashboard/curse/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTripById, listUnplannedOrders } from "@/lib/data/trips";
import { listVehicles } from "@/lib/data/vehicles";
import { listDrivers } from "@/lib/data/drivers";
import { TRIP_EDITABLE_STATUSES } from "@/lib/tripStatus";
import { toDateKey } from "@/lib/documentStatus";
import { STOP_TYPE_LABELS } from "@/lib/orderStatus";
import { PageHeader } from "@/components/page-header";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { TripStatusActions } from "./trip-status-actions";
import { TripResourcesForm } from "./resources-form";
import { TripOrders } from "./trip-orders";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

/**
 * The resource lists only carry active records, so a truck sold after this trip
 * was planned would be missing from its own dropdown — and saving the form would
 * silently unassign it. This puts the currently-assigned one back, labelled.
 */
function withCurrent(
  options: { id: string; label: string }[],
  currentId: string | null,
  currentLabel: string | null | undefined
) {
  if (!currentId || options.some((o) => o.id === currentId)) return options;
  return [{ id: currentId, label: `${currentLabel ?? currentId} (inactiv)` }, ...options];
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };

  const trip = await getTripById(sessionUser, id);
  if (!trip) notFound();

  const editable = (TRIP_EDITABLE_STATUSES as readonly string[]).includes(trip.status);

  const [vehicles, drivers, unplanned] = await Promise.all([
    listVehicles(sessionUser, session!.user.companyId!),
    listDrivers(sessionUser, session!.user.companyId!),
    listUnplannedOrders(sessionUser, session!.user.companyId!),
  ]);

  // All stops of all attached orders, in date order — the trip's actual route.
  const route = trip.orders
    .flatMap((order) => order.stops.map((stop) => ({ order: order.orderNumber, stop })))
    .sort((a, b) => a.stop.scheduledDate.getTime() - b.stop.scheduledDate.getTime());

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/dispecerat"
        className="text-muted-foreground mb-4 inline-block text-sm underline"
      >
        ← Înapoi la dispecerat
      </Link>

      <PageHeader
        title={`Cursa ${trip.tripNumber}`}
        description={
          <>
            {formatDate(trip.startsAt)} – {formatDate(trip.endsAt)} ·{" "}
            <TripStatusBadge status={trip.status} />
          </>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Stare</h2>
        <TripStatusActions tripId={trip.id} status={trip.status} />
      </section>

      {editable ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium">Alocare</h2>
          <TripResourcesForm
            tripId={trip.id}
            tractorUnits={withCurrent(
              vehicles
                .filter((v) => v.type !== "SEMI_TRAILER")
                .map((v) => ({ id: v.id, label: v.registrationNumber })),
              trip.tractorUnitId,
              trip.tractorUnit?.registrationNumber
            )}
            trailers={withCurrent(
              vehicles
                .filter((v) => v.type === "SEMI_TRAILER")
                .map((v) => ({ id: v.id, label: v.registrationNumber })),
              trip.trailerId,
              trip.trailer?.registrationNumber
            )}
            drivers={withCurrent(
              withCurrent(
                drivers.map((d) => ({ id: d.id, label: `${d.lastName} ${d.firstName}` })),
                trip.primaryDriverId,
                trip.primaryDriver && `${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`
              ),
              trip.secondDriverId,
              trip.secondDriver && `${trip.secondDriver.lastName} ${trip.secondDriver.firstName}`
            )}
            values={{
              startsAt: toDateKey(trip.startsAt),
              endsAt: toDateKey(trip.endsAt),
              tractorUnitId: trip.tractorUnitId ?? "",
              trailerId: trip.trailerId ?? "",
              primaryDriverId: trip.primaryDriverId ?? "",
              secondDriverId: trip.secondDriverId ?? "",
            }}
          />
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium">Alocare</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Cap tractor</dt>
              <dd>{trip.tractorUnit?.registrationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Semiremorcă</dt>
              <dd>{trip.trailer?.registrationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Șofer</dt>
              <dd>
                {trip.primaryDriver
                  ? `${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Al doilea șofer</dt>
              <dd>
                {trip.secondDriver
                  ? `${trip.secondDriver.lastName} ${trip.secondDriver.firstName}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <TripOrders
        tripId={trip.id}
        editable={editable}
        attached={trip.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          clientName: o.client.name,
        }))}
        attachable={unplanned.map((o) => ({
          id: o.id,
          label: `${o.orderNumber} — ${o.client.name}`,
        }))}
      />

      {route.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">Traseu</h2>
          <ol className="space-y-2">
            {route.map(({ order, stop }) => (
              <li key={stop.id} className="rounded-lg border p-3 text-sm">
                <span className="font-medium">{STOP_TYPE_LABELS[stop.type]}</span>{" "}
                <span className="text-muted-foreground">
                  {formatDate(stop.scheduledDate)} · {order}
                </span>
                <p>
                  {stop.address}, {stop.city}, {stop.country}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {trip.notes && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium">Observații</h2>
          <p className="text-sm">{trip.notes}</p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Arată cursa pe fișa comenzii**

Modify `app/dashboard/comenzi/[id]/page.tsx` — add these imports next to the existing ones:

```tsx
import { buttonVariants } from "@/components/ui/button";
```

The page already loads the order via `getOrderById`, whose payload now includes
`tripId`. Append this section immediately before the closing `</div>` of the
page:

```tsx
      <section className="mt-10 border-t pt-8">
        <h2 className="mb-3 text-sm font-medium">Planificare</h2>
        {order.tripId ? (
          <p className="text-sm">
            Comanda este pe cursa{" "}
            <Link href={`/dashboard/curse/${order.tripId}`} className="underline">
              vezi cursa
            </Link>
            .
          </p>
        ) : order.status === "CONFIRMED" ? (
          <Link
            href={`/dashboard/curse/noua?comanda=${order.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Planifică pe o cursă
          </Link>
        ) : (
          <p className="text-muted-foreground text-sm">
            Comanda poate fi planificată după ce este confirmată.
          </p>
        )}
      </section>
```

- [ ] **Step 9: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 10: Verifică manual în browser**

Run `npm run dev`, log in as a company user. Create two confirmed orders, then:
create a trip from one of them, assign a tractor and driver, attach the second
order and confirm the trip's date range widened to cover both. Create a second
trip with the same tractor over an overlapping range and confirm the amber
warning names the first trip **and the form keeps everything you selected** —
then submit again and confirm it goes through. Start the trip and confirm both
orders moved to "În execuție".

- [ ] **Step 11: Commit**

```bash
git add app/dashboard/curse app/dashboard/comenzi
git commit -m "feat: add trip creation, detail page and order planning"
```

---

## Task 9: Checklist final de testare manuală

No new code — end-to-end verification of the whole module, run locally or on production.

- [ ] Creează două comenzi și confirmă-le; verifică apoi că apar în „Comenzi neplanificate" pe ecranul de dispecerat
- [ ] Creează o comandă și **nu** o confirma; confirmă că NU apare în lista de neplanificate
- [ ] Din lista de neplanificate, apasă „Planifică" pe o comandă; confirmă că datele cursei sunt precompletate din opririle ei
- [ ] Alocă un cap tractor și un șofer; confirmă că se salvează
- [ ] Atașează a doua comandă la aceeași cursă; confirmă că intervalul cursei s-a lărgit ca să le cuprindă pe amândouă
- [ ] Modifică manual sfârșitul cursei (adaugă o zi de întoarcere); detașează și reatașează o comandă; confirmă că **ziua adăugată de tine NU a fost ștearsă**
- [ ] Creează o a doua cursă cu același cap tractor, pe un interval care se suprapune; confirmă avertismentul galben cu numărul primei curse, **și că formularul păstrează tot ce ai ales**
- [ ] Apasă din nou pe buton; confirmă că cursa se creează oricum
- [ ] Creează o cursă care începe exact în ziua în care se termină alta, cu același camion; confirmă că **este** semnalată ca suprapunere
- [ ] Pornește prima cursă; confirmă că ambele comenzi ale ei au trecut în „În execuție"
- [ ] Încheie cursa; confirmă că ambele comenzi au trecut în „Livrată"
- [ ] Confirmă că pe o cursă încheiată nu mai poți atașa sau desprinde comenzi
- [ ] Anulează o altă cursă; confirmă că întrebarea de confirmare apare și că apoi comenzile ei revin în lista de neplanificate, cu starea nemodificată
- [ ] Anulează o comandă care e pe o cursă; confirmă că dispare din cursă
- [ ] Pe fișa unei comenzi planificate, confirmă linkul către cursă
- [ ] Dezactivează un camion care e alocat pe o cursă planificată; deschide cursa și confirmă că vehiculul apare în listă marcat „(inactiv)", că poți salva alte modificări fără să-l pierzi, și că nu poți aloca acel camion pe o cursă nouă
- [ ] Loghează-te cu a doua firmă; confirmă că nu vezi nicio cursă a primei firme
- [ ] Fiind logat cu a doua firmă, deschide manual adresa unei curse a primei firme; confirmă 404
