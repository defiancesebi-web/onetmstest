# ONE x TMS — Modulul 3: Flotă & Șoferi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vehicles and drivers with their documents, and warn on the dashboard when a document is expired or about to expire.

**Architecture:** Extends the existing Next.js 16 App Router monolith. Three new Prisma models (`Vehicle`, `Driver`, `Document`) follow the established tenant pattern: every row carries `companyId`, and every data-access function takes `SessionUser` first and calls `assertCompanyAccess` before touching the database. Expiry-status arithmetic lives in a pure, database-free module so it can be tested exhaustively at its boundaries. `Document` is a single shared table for both owner types, so the alert is one query.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`), PostgreSQL (Neon), Auth.js v5, Tailwind CSS v4, shadcn/ui, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-17-one-x-tms-fleet-design.md](../specs/2026-08-17-one-x-tms-fleet-design.md)

## Global Constraints

- All user-facing text (labels, buttons, placeholders, error messages) is in Romanian.
- Every function that reads or writes company-scoped data MUST call `assertCompanyAccess(session, companyId)` from `lib/tenancy.ts` before the query, or reach it through a helper that does. This is the core security invariant of the product — no exceptions, including for `Document`, which the alert query reaches directly.
- Cross-tenant access returns **404** via `null` from read functions; write functions throw `TenantAccessError`. Never 403 — it confirms the resource exists.
- A not-found id surfaces a Romanian product error (a class extending `Error` with `this.name` set), never a raw Prisma error. `findUniqueOrThrow` is banned for this reason.
- **Enum values are English EXCEPT `DocumentType`**, whose members are Romanian regulatory terms (`ITP`, `RCA`, `ROVINIETA`, `COPIE_CONFORMA`) with no real English equivalent. `VehicleType` stays English.
- Dates that decide "is this expired" are evaluated in **`Europe/Bucharest`**, never server-local time — the server runs UTC. `lib/data/orders.ts` already establishes this with `currentOrderYear()`.
- **React 19 resets a `<form action>` after every action call.** Any form whose action can return an error instead of redirecting MUST use controlled inputs backed by React state, or the user silently loses their typing. Three forms in Module 2 were bitten by this; write every form here controlled from the start and verify a failed submit in the browser.
- This project's `Button` is built on Base UI and does NOT support `asChild`. Style links as buttons with `buttonVariants()` from `@/components/ui/button`.
- Next.js 16: `params` and `searchParams` are Promises and must be awaited.
- TypeScript strict mode; no `any`. No placeholder code, no `TODO`.

---

## Task 1: Modele Vehicle & Driver + migrare

**Files:**
- Modify: `prisma/schema.prisma`, `tests/helpers/db.ts`
- Create: `prisma/migrations/<timestamp>_add_vehicle_driver/migration.sql` (generated)

**Interfaces:**
- Produces: `Vehicle`, `Driver` models; enum `VehicleType`; types `VehicleModel`, `DriverModel`. Consumed by Tasks 2-10.

- [ ] **Step 1: Adaugă enum-ul și modelele**

Modify `prisma/schema.prisma` — add at the end of the file:

```prisma
enum VehicleType {
  TRACTOR_UNIT
  SEMI_TRAILER
  RIGID_TRUCK
  VAN_3_5T
}

model Vehicle {
  id                 String      @id @default(cuid())
  companyId          String
  registrationNumber String
  type               VehicleType
  make               String?
  model              String?
  manufactureYear    Int?
  vin                String?
  isActive           Boolean     @default(true)
  notes              String?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  company Company @relation(fields: [companyId], references: [id])

  @@unique([companyId, registrationNumber])
  @@index([companyId, isActive])
}

model Driver {
  id         String    @id @default(cuid())
  companyId  String
  firstName  String
  lastName   String
  phone      String?
  email      String?
  personalId String?
  hiredAt    DateTime? @db.Date
  isActive   Boolean   @default(true)
  notes      String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  company Company @relation(fields: [companyId], references: [id])

  @@index([companyId, lastName])
}
```

Add the back-relations inside the existing `model Company`, next to `clients` and `orders`:

```prisma
  vehicles    Vehicle[]
  drivers     Driver[]
```

- [ ] **Step 2: Rulează migrarea pe baza de dezvoltare**

Run: `npx prisma migrate dev --name add_vehicle_driver`
Expected: migration applies, `Vehicle` and `Driver` tables created.

If Neon returns a transient `P1001` (cold start), retry the command once before treating it as a real failure.

- [ ] **Step 3: Aplică migrarea pe baza de test**

The suite runs against a separate database; new tables must exist there or every later test fails.

Run (bash):
```bash
DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d'"' -f2) npx prisma migrate deploy
```

Run (PowerShell):
```bash
$env:DATABASE_URL=(Get-Content .env.test | Select-String 'DATABASE_URL' | ForEach-Object { $_ -replace 'DATABASE_URL=','' -replace '"','' }); npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 4: Extinde curățarea bazei de test**

Both tables reference `Company`, so they must be cleared before it or `company.deleteMany()` raises a foreign-key violation in every later test.

Modify `tests/helpers/db.ts` — replace the body of `resetDatabase`, adding the two new lines above the existing `client.deleteMany()`:

```ts
export async function resetDatabase() {
  await prisma.orderStop.deleteMany();
  await prisma.order.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
```

- [ ] **Step 5: Regenerează, verifică tipurile și testele**

Run: `npx prisma generate && npx tsc --noEmit && npm test`
Expected: `tsc` silent, all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/ tests/helpers/db.ts
git commit -m "feat: add Vehicle and Driver models"
```

---

## Task 2: Acces la date pentru vehicule și șoferi

**Files:**
- Create: `lib/data/vehicles.ts`, `lib/data/drivers.ts`
- Test: `tests/data/vehicles.test.ts`, `tests/data/drivers.test.ts`

**Interfaces:**
- Consumes: `prisma`, `assertCompanyAccess`/`SessionUser`/`TenantAccessError`, `VehicleType` from `@/lib/generated/prisma/enums`.
- Produces:
  - `listVehicles(session, companyId, options?: { search?: string; includeInactive?: boolean })`, `getVehicleById(session, vehicleId)`, `createVehicle(session, input)`, `updateVehicle(session, vehicleId, input)`, `setVehicleActive(session, vehicleId, isActive)`, types `CreateVehicleInput`/`UpdateVehicleInput`, classes `VehicleNotFoundError`, `DuplicateRegistrationError` — all from `lib/data/vehicles.ts`
  - The same shape for drivers from `lib/data/drivers.ts`: `listDrivers`, `getDriverById`, `createDriver`, `updateDriver`, `setDriverActive`, `CreateDriverInput`, `UpdateDriverInput`, `DriverNotFoundError`

- [ ] **Step 1: Scrie testele pentru vehicule**

Write `tests/data/vehicles.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  listVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  setVehicleActive,
  DuplicateRegistrationError,
  VehicleNotFoundError,
} from "@/lib/data/vehicles";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

const base = { registrationNumber: "B-123-ABC", type: "TRACTOR_UNIT" as const };

describe("createVehicle", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un vehicul activ", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const vehicle = await createVehicle(session, { ...base, companyId: company.id });

    expect(vehicle.isActive).toBe(true);
    expect(vehicle.type).toBe("TRACTOR_UNIT");
    expect(vehicle.companyId).toBe(company.id);
  });

  it("acceptă toate cele patru tipuri de vehicul", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    for (const [i, type] of (["TRACTOR_UNIT", "SEMI_TRAILER", "RIGID_TRUCK", "VAN_3_5T"] as const).entries()) {
      const v = await createVehicle(session, {
        companyId: company.id,
        registrationNumber: `B-00${i}-XYZ`,
        type,
      });
      expect(v.type).toBe(type);
    }
  });

  it("respinge un număr de înmatriculare duplicat în aceeași firmă", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createVehicle(session, { ...base, companyId: company.id });

    await expect(
      createVehicle(session, { ...base, companyId: company.id })
    ).rejects.toThrow(DuplicateRegistrationError);
  });

  it("permite același număr în firme diferite", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await createVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: a.id });
    const vb = await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    expect(vb.companyId).toBe(b.id);
  });

  it("respinge crearea pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      createVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: b.id })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listVehicles", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar vehiculele firmei cerute", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    await createVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: a.id });
    await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { companyId: b.id, registrationNumber: "CJ-999-ZZZ", type: "RIGID_TRUCK" }
    );

    const result = await listVehicles({ role: "COMPANY_ADMIN", companyId: a.id }, a.id);

    expect(result).toHaveLength(1);
    expect(result[0].registrationNumber).toBe("B-123-ABC");
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      listVehicles({ role: "COMPANY_ADMIN", companyId: a.id }, b.id)
    ).rejects.toThrow(TenantAccessError);
  });

  it("ascunde vehiculele inactive implicit și le arată la cerere", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const vehicle = await createVehicle(session, { ...base, companyId: company.id });
    await setVehicleActive(session, vehicle.id, false);

    expect(await listVehicles(session, company.id)).toHaveLength(0);
    expect(await listVehicles(session, company.id, { includeInactive: true })).toHaveLength(1);
  });

  it("caută după numărul de înmatriculare", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createVehicle(session, { ...base, companyId: company.id });
    await createVehicle(session, {
      companyId: company.id,
      registrationNumber: "CJ-555-QQQ",
      type: "VAN_3_5T",
    });

    expect(await listVehicles(session, company.id, { search: "123" })).toHaveLength(1);
    expect(await listVehicles(session, company.id, { search: "cj" })).toHaveLength(1);
  });
});

describe("getVehicleById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru un vehicul din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const vb = await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    expect(await getVehicleById({ role: "COMPANY_ADMIN", companyId: a.id }, vb.id)).toBeNull();
  });
});

describe("updateVehicle", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge modificarea unui vehicul din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const vb = await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    await expect(
      updateVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, vb.id, { make: "Furat" })
    ).rejects.toThrow(TenantAccessError);
  });

  it("aruncă o eroare în română pentru un id inexistent", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(updateVehicle(session, "id-inexistent", { make: "X" })).rejects.toThrow(
      VehicleNotFoundError
    );
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/vehicles.ts` nu există.

- [ ] **Step 3: Implementează `lib/data/vehicles.ts`**

Write `lib/data/vehicles.ts`:

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import type { VehicleType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export class VehicleNotFoundError extends Error {
  constructor() {
    super("Vehiculul nu a fost găsit.");
    this.name = "VehicleNotFoundError";
  }
}

export class DuplicateRegistrationError extends Error {
  constructor(registrationNumber: string) {
    super(`Există deja un vehicul cu numărul ${registrationNumber}.`);
    this.name = "DuplicateRegistrationError";
  }
}

export type CreateVehicleInput = {
  companyId: string;
  registrationNumber: string;
  type: VehicleType;
  make?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  vin?: string | null;
  notes?: string | null;
};

export type UpdateVehicleInput = Partial<Omit<CreateVehicleInput, "companyId">>;

export async function listVehicles(
  session: SessionUser,
  companyId: string,
  options: { search?: string; includeInactive?: boolean } = {}
) {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.vehicle.findMany({
    where: {
      companyId,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(search
        ? { registrationNumber: { contains: search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { registrationNumber: "asc" },
  });
}

export async function getVehicleById(session: SessionUser, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return null;
  // Null rather than throw, so pages render 404 without revealing existence.
  if (vehicle.companyId !== session.companyId) return null;
  return vehicle;
}

async function assertOwnVehicle(session: SessionUser, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new VehicleNotFoundError();
  assertCompanyAccess(session, vehicle.companyId);
  return vehicle;
}

export async function createVehicle(session: SessionUser, input: CreateVehicleInput) {
  assertCompanyAccess(session, input.companyId);

  try {
    return await prisma.vehicle.create({
      data: {
        companyId: input.companyId,
        registrationNumber: input.registrationNumber,
        type: input.type,
        make: input.make ?? null,
        model: input.model ?? null,
        manufactureYear: input.manufactureYear ?? null,
        vin: input.vin ?? null,
        notes: input.notes ?? null,
      },
    });
  } catch (error) {
    // The unique index on (companyId, registrationNumber) is the real guard;
    // catching P2002 turns it into a Romanian message instead of a raw error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateRegistrationError(input.registrationNumber);
    }
    throw error;
  }
}

export async function updateVehicle(
  session: SessionUser,
  vehicleId: string,
  input: UpdateVehicleInput
) {
  await assertOwnVehicle(session, vehicleId);

  try {
    return await prisma.vehicle.update({ where: { id: vehicleId }, data: input });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateRegistrationError(input.registrationNumber ?? "");
    }
    throw error;
  }
}

export async function setVehicleActive(
  session: SessionUser,
  vehicleId: string,
  isActive: boolean
) {
  await assertOwnVehicle(session, vehicleId);
  return prisma.vehicle.update({ where: { id: vehicleId }, data: { isActive } });
}
```

- [ ] **Step 4: Rulează testele pentru vehicule**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Scrie testele pentru șoferi**

Write `tests/data/drivers.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  listDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  setDriverActive,
  DriverNotFoundError,
} from "@/lib/data/drivers";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

const base = { firstName: "Ion", lastName: "Popescu" };

describe("createDriver", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un șofer activ", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const driver = await createDriver(session, { ...base, companyId: company.id });

    expect(driver.isActive).toBe(true);
    expect(driver.lastName).toBe("Popescu");
    expect(driver.personalId).toBeNull();
  });

  it("respinge crearea pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      createDriver({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: b.id })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listDrivers", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar șoferii firmei cerute", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    await createDriver({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: a.id });
    await createDriver(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { companyId: b.id, firstName: "Vasile", lastName: "Ionescu" }
    );

    const result = await listDrivers({ role: "COMPANY_ADMIN", companyId: a.id }, a.id);

    expect(result).toHaveLength(1);
    expect(result[0].lastName).toBe("Popescu");
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      listDrivers({ role: "COMPANY_ADMIN", companyId: a.id }, b.id)
    ).rejects.toThrow(TenantAccessError);
  });

  it("ascunde șoferii inactivi implicit și îi arată la cerere", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const driver = await createDriver(session, { ...base, companyId: company.id });
    await setDriverActive(session, driver.id, false);

    expect(await listDrivers(session, company.id)).toHaveLength(0);
    expect(await listDrivers(session, company.id, { includeInactive: true })).toHaveLength(1);
  });

  it("caută după nume și prenume", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createDriver(session, { ...base, companyId: company.id });
    await createDriver(session, {
      companyId: company.id,
      firstName: "Vasile",
      lastName: "Georgescu",
    });

    expect(await listDrivers(session, company.id, { search: "popescu" })).toHaveLength(1);
    expect(await listDrivers(session, company.id, { search: "vasile" })).toHaveLength(1);
  });
});

describe("getDriverById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru un șofer din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const db = await createDriver(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    expect(await getDriverById({ role: "COMPANY_ADMIN", companyId: a.id }, db.id)).toBeNull();
  });
});

describe("updateDriver", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge modificarea unui șofer din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const db = await createDriver(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    await expect(
      updateDriver({ role: "COMPANY_ADMIN", companyId: a.id }, db.id, { phone: "0700" })
    ).rejects.toThrow(TenantAccessError);
  });

  it("aruncă o eroare în română pentru un id inexistent", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(updateDriver(session, "id-inexistent", { phone: "0700" })).rejects.toThrow(
      DriverNotFoundError
    );
  });
});
```

- [ ] **Step 6: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/drivers.ts` nu există.

- [ ] **Step 7: Implementează `lib/data/drivers.ts`**

Write `lib/data/drivers.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export class DriverNotFoundError extends Error {
  constructor() {
    super("Șoferul nu a fost găsit.");
    this.name = "DriverNotFoundError";
  }
}

export type CreateDriverInput = {
  companyId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  personalId?: string | null;
  hiredAt?: Date | null;
  notes?: string | null;
};

export type UpdateDriverInput = Partial<Omit<CreateDriverInput, "companyId">>;

export async function listDrivers(
  session: SessionUser,
  companyId: string,
  options: { search?: string; includeInactive?: boolean } = {}
) {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.driver.findMany({
    where: {
      companyId,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getDriverById(session: SessionUser, driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) return null;
  if (driver.companyId !== session.companyId) return null;
  return driver;
}

async function assertOwnDriver(session: SessionUser, driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new DriverNotFoundError();
  assertCompanyAccess(session, driver.companyId);
  return driver;
}

export async function createDriver(session: SessionUser, input: CreateDriverInput) {
  assertCompanyAccess(session, input.companyId);

  return prisma.driver.create({
    data: {
      companyId: input.companyId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      personalId: input.personalId ?? null,
      hiredAt: input.hiredAt ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function updateDriver(
  session: SessionUser,
  driverId: string,
  input: UpdateDriverInput
) {
  await assertOwnDriver(session, driverId);
  return prisma.driver.update({ where: { id: driverId }, data: input });
}

export async function setDriverActive(
  session: SessionUser,
  driverId: string,
  isActive: boolean
) {
  await assertOwnDriver(session, driverId);
  return prisma.driver.update({ where: { id: driverId }, data: { isActive } });
}
```

- [ ] **Step 8: Rulează testele și verifică tipurile**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/data/vehicles.ts lib/data/drivers.ts tests/data/vehicles.test.ts tests/data/drivers.test.ts
git commit -m "feat: add tenant-scoped vehicle and driver data access"
```

---

## Task 3: Model Document + migrare

**Files:**
- Modify: `prisma/schema.prisma`, `tests/helpers/db.ts`
- Create: `prisma/migrations/<timestamp>_add_document/migration.sql` (generated, then hand-edited)

**Interfaces:**
- Produces: `Document` model, enum `DocumentType`, type `DocumentModel`. Consumed by Tasks 5-9.

- [ ] **Step 1: Adaugă enum-ul și modelul**

Modify `prisma/schema.prisma` — add at the end:

```prisma
enum DocumentType {
  ITP
  RCA
  CASCO
  ROVINIETA
  TAHOGRAF
  COPIE_CONFORMA
  ASIGURARE_CMR
  PERMIS_CONDUCERE
  ATESTAT_PROFESIONAL
  CARD_TAHOGRAF
  AVIZ_MEDICAL
  AVIZ_PSIHOLOGIC
}

model Document {
  id        String       @id @default(cuid())
  companyId String
  vehicleId String?
  driverId  String?
  type      DocumentType
  number    String?
  issuedAt  DateTime?    @db.Date
  expiresAt DateTime     @db.Date
  notes     String?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  company Company  @relation(fields: [companyId], references: [id])
  vehicle Vehicle? @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  driver  Driver?  @relation(fields: [driverId], references: [id], onDelete: Cascade)

  @@index([companyId, expiresAt])
}
```

Add the back-relations. Inside `model Company`, next to `vehicles`/`drivers`:

```prisma
  documents   Document[]
```

Inside `model Vehicle`, after the `company` relation line:

```prisma
  documents Document[]
```

Inside `model Driver`, after the `company` relation line:

```prisma
  documents Document[]
```

- [ ] **Step 2: Generează migrarea**

Run: `npx prisma migrate dev --name add_document`
Expected: migration applies, `Document` table created.

- [ ] **Step 3: Adaugă constrângerea „exact un proprietar" în migrare**

The data layer validates this, but a database constraint means no future code path — a script, a manual query, a later module — can create a document owned by both or neither.

Open the file `prisma/migrations/<timestamp>_add_document/migration.sql` that was just generated and append this at the end:

```sql
ALTER TABLE "Document" ADD CONSTRAINT "Document_exactly_one_owner"
  CHECK (("vehicleId" IS NOT NULL AND "driverId" IS NULL)
      OR ("vehicleId" IS NULL AND "driverId" IS NOT NULL));
```

The migration has already been applied, so run the statement against the development database directly to bring it in line. Save this as a temporary file `apply-check.sql` in the project root, containing exactly the SQL above, then run:

```bash
npx prisma db execute --file apply-check.sql --schema prisma/schema.prisma
```

Delete `apply-check.sql` afterwards. `prisma migrate deploy` will apply the edited migration file in full on the test and production databases, which have not seen it yet.

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

Documents reference vehicles and drivers, so they go first.

Modify `tests/helpers/db.ts` — add one line at the top of `resetDatabase`'s body:

```ts
  await prisma.document.deleteMany();
```

- [ ] **Step 6: Testează că baza chiar respinge un document fără proprietar**

Write `tests/data/documentConstraint.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";

describe("constrângerea de proprietar unic pe Document", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge un document fără proprietar", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });

    await expect(
      prisma.document.create({
        data: {
          companyId: company.id,
          type: "ITP",
          expiresAt: new Date("2026-12-31"),
        },
      })
    ).rejects.toThrow();
  });

  it("respinge un document cu doi proprietari", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const vehicle = await prisma.vehicle.create({
      data: { companyId: company.id, registrationNumber: "B-1-AAA", type: "TRACTOR_UNIT" },
    });
    const driver = await prisma.driver.create({
      data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
    });

    await expect(
      prisma.document.create({
        data: {
          companyId: company.id,
          vehicleId: vehicle.id,
          driverId: driver.id,
          type: "ITP",
          expiresAt: new Date("2026-12-31"),
        },
      })
    ).rejects.toThrow();
  });

  it("acceptă un document cu exact un proprietar", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const vehicle = await prisma.vehicle.create({
      data: { companyId: company.id, registrationNumber: "B-1-AAA", type: "TRACTOR_UNIT" },
    });

    const doc = await prisma.document.create({
      data: {
        companyId: company.id,
        vehicleId: vehicle.id,
        type: "ITP",
        expiresAt: new Date("2026-12-31"),
      },
    });

    expect(doc.vehicleId).toBe(vehicle.id);
    expect(doc.driverId).toBeNull();
  });
});
```

- [ ] **Step 7: Regenerează, verifică tipurile și testele**

Run: `npx prisma generate && npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS including the three new constraint tests.

- [ ] **Step 8: Commit**

```bash
git add prisma/ tests/helpers/db.ts tests/data/documentConstraint.test.ts
git commit -m "feat: add Document model with an exactly-one-owner constraint"
```

---

## Task 4: Calculul stării documentelor (modul pur)

**Files:**
- Create: `lib/documentStatus.ts`
- Test: `tests/documentStatus.test.ts`

**Interfaces:**
- Consumes: `DocumentType`, `VehicleType` from `@/lib/generated/prisma/enums`.
- Produces:
  - `EXPIRY_WARNING_DAYS` constant
  - `type DocumentStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID"`
  - `type OwnerDocumentStatus = DocumentStatus | "NO_DOCUMENTS"`
  - `todayKeyInBucharest(now?: Date): string`
  - `toDateKey(date: Date): string`
  - `documentStatus(expiresAt: Date, now?: Date): DocumentStatus`
  - `aggregateOwnerStatus(statuses: DocumentStatus[]): OwnerDocumentStatus`
  - `DOCUMENT_STATUS_LABELS`, `OWNER_STATUS_LABELS`, `DOCUMENT_TYPE_LABELS`, `VEHICLE_TYPE_LABELS`
  - `VEHICLE_DOCUMENT_TYPES`, `DRIVER_DOCUMENT_TYPES` arrays

- [ ] **Step 1: Scrie testele care eșuează**

This module has no database and no network, so its boundaries can be tested exhaustively — which matters, because an off-by-one here means an expired document silently reads as valid.

Write `tests/documentStatus.test.ts`:

```ts
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
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/documentStatus.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/documentStatus.ts`:

```ts
import type { DocumentType, VehicleType } from "@/lib/generated/prisma/enums";

export const EXPIRY_WARNING_DAYS = 30;

export type DocumentStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";
export type OwnerDocumentStatus = DocumentStatus | "NO_DOCUMENTS";

/**
 * Prisma returns `@db.Date` columns as a Date at UTC midnight, so reading the
 * UTC parts gives back exactly the stored calendar day. Using local getters
 * here would shift the day for any server west of UTC.
 */
export function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * "Today" is a Romanian calendar day, not the server's. Vercel runs UTC, so
 * between midnight and 03:00 Bucharest time the two disagree — and a document
 * would read as valid for three hours after it expired.
 */
export function todayKeyInBucharest(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function daysBetweenKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export function documentStatus(expiresAt: Date, now: Date = new Date()): DocumentStatus {
  const todayKey = todayKeyInBucharest(now);
  const expiryKey = toDateKey(expiresAt);

  if (expiryKey < todayKey) return "EXPIRED";

  // A document expiring today is still valid today — it counts as a warning,
  // not as expired.
  return daysBetweenKeys(todayKey, expiryKey) <= EXPIRY_WARNING_DAYS
    ? "EXPIRING_SOON"
    : "VALID";
}

const SEVERITY: Record<DocumentStatus, number> = {
  EXPIRED: 3,
  EXPIRING_SOON: 2,
  VALID: 1,
};

export function aggregateOwnerStatus(statuses: DocumentStatus[]): OwnerDocumentStatus {
  if (statuses.length === 0) return "NO_DOCUMENTS";
  return statuses.reduce((worst, current) =>
    SEVERITY[current] > SEVERITY[worst] ? current : worst
  );
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  EXPIRED: "Expirat",
  EXPIRING_SOON: "Expiră curând",
  VALID: "În regulă",
};

export const OWNER_STATUS_LABELS: Record<OwnerDocumentStatus, string> = {
  ...DOCUMENT_STATUS_LABELS,
  NO_DOCUMENTS: "Fără documente",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ITP: "ITP",
  RCA: "RCA",
  CASCO: "CASCO",
  ROVINIETA: "Rovinietă",
  TAHOGRAF: "Verificare tahograf",
  COPIE_CONFORMA: "Copie conformă",
  ASIGURARE_CMR: "Asigurare CMR",
  PERMIS_CONDUCERE: "Permis de conducere",
  ATESTAT_PROFESIONAL: "Atestat profesional",
  CARD_TAHOGRAF: "Card tahograf",
  AVIZ_MEDICAL: "Aviz medical",
  AVIZ_PSIHOLOGIC: "Aviz psihologic",
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  TRACTOR_UNIT: "Cap tractor",
  SEMI_TRAILER: "Semiremorcă",
  RIGID_TRUCK: "Autocamion",
  VAN_3_5T: "Dubă 3.5t",
};

/** Which types the UI offers, depending on what the document is attached to. */
export const VEHICLE_DOCUMENT_TYPES = [
  "ITP",
  "RCA",
  "CASCO",
  "ROVINIETA",
  "TAHOGRAF",
  "COPIE_CONFORMA",
  "ASIGURARE_CMR",
] as const satisfies readonly DocumentType[];

export const DRIVER_DOCUMENT_TYPES = [
  "PERMIS_CONDUCERE",
  "ATESTAT_PROFESIONAL",
  "CARD_TAHOGRAF",
  "AVIZ_MEDICAL",
  "AVIZ_PSIHOLOGIC",
] as const satisfies readonly DocumentType[];
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/documentStatus.ts tests/documentStatus.test.ts
git commit -m "feat: add document expiry status calculation"
```

---

## Task 5: Acces la date pentru documente și alerte

**Files:**
- Create: `lib/data/documents.ts`
- Test: `tests/data/documents.test.ts`

**Interfaces:**
- Consumes: `prisma`, `assertCompanyAccess`/`SessionUser`/`TenantAccessError`, `documentStatus`/`aggregateOwnerStatus`/`EXPIRY_WARNING_DAYS`/`toDateKey`/`todayKeyInBucharest` (Task 4), `DocumentType` enum.
- Produces:
  - `createDocument(session, input)`, `updateDocument(session, documentId, input)`, `deleteDocument(session, documentId)`
  - `listDocumentsForVehicle(session, vehicleId)`, `listDocumentsForDriver(session, driverId)`
  - `getExpiringDocuments(session, companyId, now?)`
  - `getOwnerStatuses(session, companyId, now?)`
  - types `CreateDocumentInput`, `UpdateDocumentInput`, `ExpiringDocument`
  - classes `DocumentNotFoundError`, `InvalidDocumentOwnerError`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/documents.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  createDocument,
  updateDocument,
  deleteDocument,
  listDocumentsForVehicle,
  getExpiringDocuments,
  getOwnerStatuses,
  InvalidDocumentOwnerError,
  DocumentNotFoundError,
} from "@/lib/data/documents";
import { TenantAccessError } from "@/lib/tenancy";

const NOW = new Date("2026-08-18T09:00:00Z");

function dateOnly(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setup(companyName: string, cui: string) {
  const company = await prisma.company.create({ data: { name: companyName, cui } });
  const vehicle = await prisma.vehicle.create({
    data: { companyId: company.id, registrationNumber: `B-1-${cui}`, type: "TRACTOR_UNIT" },
  });
  const driver = await prisma.driver.create({
    data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
  });
  return {
    company,
    vehicle,
    driver,
    session: { role: "COMPANY_ADMIN" as const, companyId: company.id },
  };
}

describe("createDocument", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un document pe vehicul", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");

    const doc = await createDocument(session, {
      vehicleId: vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-12-31"),
    });

    expect(doc.vehicleId).toBe(vehicle.id);
    expect(doc.driverId).toBeNull();
  });

  it("creează un document pe șofer", async () => {
    const { driver, session } = await setup("Firma A", "RO1");

    const doc = await createDocument(session, {
      driverId: driver.id,
      type: "PERMIS_CONDUCERE",
      expiresAt: dateOnly("2027-01-15"),
    });

    expect(doc.driverId).toBe(driver.id);
    expect(doc.vehicleId).toBeNull();
  });

  it("respinge un document fără proprietar", async () => {
    const { session } = await setup("Firma A", "RO1");

    await expect(
      createDocument(session, { type: "ITP", expiresAt: dateOnly("2026-12-31") })
    ).rejects.toThrow(InvalidDocumentOwnerError);
  });

  it("respinge un document cu doi proprietari", async () => {
    const { vehicle, driver, session } = await setup("Firma A", "RO1");

    await expect(
      createDocument(session, {
        vehicleId: vehicle.id,
        driverId: driver.id,
        type: "ITP",
        expiresAt: dateOnly("2026-12-31"),
      })
    ).rejects.toThrow(InvalidDocumentOwnerError);
  });

  it("respinge un vehicul care aparține altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(
      createDocument(a.session, {
        vehicleId: b.vehicle.id,
        type: "ITP",
        expiresAt: dateOnly("2026-12-31"),
      })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listDocumentsForVehicle", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează documentele vehiculului, sortate după expirare", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "RCA", expiresAt: dateOnly("2027-01-01") });
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-09-01") });

    const docs = await listDocumentsForVehicle(session, vehicle.id);

    expect(docs.map((d) => d.type)).toEqual(["ITP", "RCA"]);
  });

  it("respinge un vehicul din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(listDocumentsForVehicle(a.session, b.vehicle.id)).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("getExpiringDocuments", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează expirate și cele care expiră curând, expirate primele", async () => {
    const { company, vehicle, driver, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });
    await createDocument(session, { driverId: driver.id, type: "AVIZ_MEDICAL", expiresAt: dateOnly("2026-08-25") });
    await createDocument(session, { vehicleId: vehicle.id, type: "RCA", expiresAt: dateOnly("2027-06-01") });

    const result = await getExpiringDocuments(session, company.id, NOW);

    expect(result.map((d) => d.type)).toEqual(["ITP", "AVIZ_MEDICAL"]);
    expect(result[0].status).toBe("EXPIRED");
    expect(result[1].status).toBe("EXPIRING_SOON");
  });

  it("exclude documentele vehiculelor inactive", async () => {
    const { company, vehicle, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { isActive: false } });

    expect(await getExpiringDocuments(session, company.id, NOW)).toHaveLength(0);
  });

  it("exclude documentele șoferilor inactivi", async () => {
    const { company, driver, session } = await setup("Firma A", "RO1");
    await createDocument(session, { driverId: driver.id, type: "AVIZ_MEDICAL", expiresAt: dateOnly("2026-08-10") });
    await prisma.driver.update({ where: { id: driver.id }, data: { isActive: false } });

    expect(await getExpiringDocuments(session, company.id, NOW)).toHaveLength(0);
  });

  it("nu vede documentele altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    await createDocument(b.session, {
      vehicleId: b.vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    expect(await getExpiringDocuments(a.session, a.company.id, NOW)).toHaveLength(0);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(getExpiringDocuments(a.session, b.company.id, NOW)).rejects.toThrow(
      TenantAccessError
    );
  });

  it("identifică proprietarul în rezultat", async () => {
    const { company, vehicle, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });

    const [row] = await getExpiringDocuments(session, company.id, NOW);

    expect(row.ownerLabel).toBe(vehicle.registrationNumber);
    expect(row.ownerHref).toBe(`/dashboard/flota/${vehicle.id}`);
  });
});

describe("getOwnerStatuses", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("agregă cea mai gravă stare pe fiecare proprietar", async () => {
    const { company, vehicle, driver, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "RCA", expiresAt: dateOnly("2027-06-01") });
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });
    await createDocument(session, { driverId: driver.id, type: "AVIZ_MEDICAL", expiresAt: dateOnly("2026-08-25") });

    const statuses = await getOwnerStatuses(session, company.id, NOW);

    expect(statuses.vehicles[vehicle.id]).toBe("EXPIRED");
    expect(statuses.drivers[driver.id]).toBe("EXPIRING_SOON");
  });

  it("nu include proprietarii fără documente", async () => {
    const { company, vehicle, session } = await setup("Firma A", "RO1");

    const statuses = await getOwnerStatuses(session, company.id, NOW);

    expect(statuses.vehicles[vehicle.id]).toBeUndefined();
  });
});

describe("updateDocument și deleteDocument", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("modifică data de expirare la reînnoire", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");
    const doc = await createDocument(session, {
      vehicleId: vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    const updated = await updateDocument(session, doc.id, { expiresAt: dateOnly("2027-08-10") });

    expect(updated.expiresAt.toISOString().slice(0, 10)).toBe("2027-08-10");
  });

  it("șterge un document", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");
    const doc = await createDocument(session, {
      vehicleId: vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    await deleteDocument(session, doc.id);

    expect(await listDocumentsForVehicle(session, vehicle.id)).toHaveLength(0);
  });

  it("respinge ștergerea unui document din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const doc = await createDocument(b.session, {
      vehicleId: b.vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    await expect(deleteDocument(a.session, doc.id)).rejects.toThrow(TenantAccessError);
  });

  it("aruncă o eroare în română pentru un id inexistent", async () => {
    const { session } = await setup("Firma A", "RO1");

    await expect(deleteDocument(session, "id-inexistent")).rejects.toThrow(DocumentNotFoundError);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/documents.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/data/documents.ts`:

```ts
import type { DocumentType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import {
  documentStatus,
  aggregateOwnerStatus,
  todayKeyInBucharest,
  EXPIRY_WARNING_DAYS,
  type DocumentStatus,
  type OwnerDocumentStatus,
} from "@/lib/documentStatus";

export class DocumentNotFoundError extends Error {
  constructor() {
    super("Documentul nu a fost găsit.");
    this.name = "DocumentNotFoundError";
  }
}

export class InvalidDocumentOwnerError extends Error {
  constructor() {
    super("Documentul trebuie să aparțină fie unui vehicul, fie unui șofer.");
    this.name = "InvalidDocumentOwnerError";
  }
}

export type CreateDocumentInput = {
  vehicleId?: string;
  driverId?: string;
  type: DocumentType;
  number?: string | null;
  issuedAt?: Date | null;
  expiresAt: Date;
  notes?: string | null;
};

export type UpdateDocumentInput = {
  type?: DocumentType;
  number?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date;
  notes?: string | null;
};

export type ExpiringDocument = {
  id: string;
  type: DocumentType;
  expiresAt: Date;
  status: DocumentStatus;
  ownerLabel: string;
  ownerHref: string;
};

/**
 * Resolves the document's owner, proving it belongs to the session's company,
 * and returns that company's id so the document inherits it. Rejects zero or
 * two owners before touching the database — the DB has the same constraint,
 * but this produces a Romanian message instead of a raw constraint violation.
 */
async function resolveOwnerCompanyId(
  session: SessionUser,
  input: { vehicleId?: string; driverId?: string }
): Promise<string> {
  const hasVehicle = Boolean(input.vehicleId);
  const hasDriver = Boolean(input.driverId);
  if (hasVehicle === hasDriver) throw new InvalidDocumentOwnerError();

  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new InvalidDocumentOwnerError();
    assertCompanyAccess(session, vehicle.companyId);
    return vehicle.companyId;
  }

  const driver = await prisma.driver.findUnique({ where: { id: input.driverId! } });
  if (!driver) throw new InvalidDocumentOwnerError();
  assertCompanyAccess(session, driver.companyId);
  return driver.companyId;
}

async function assertOwnDocument(session: SessionUser, documentId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new DocumentNotFoundError();
  assertCompanyAccess(session, document.companyId);
  return document;
}

export async function createDocument(session: SessionUser, input: CreateDocumentInput) {
  const companyId = await resolveOwnerCompanyId(session, input);

  return prisma.document.create({
    data: {
      companyId,
      vehicleId: input.vehicleId ?? null,
      driverId: input.driverId ?? null,
      type: input.type,
      number: input.number ?? null,
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt,
      notes: input.notes ?? null,
    },
  });
}

export async function updateDocument(
  session: SessionUser,
  documentId: string,
  input: UpdateDocumentInput
) {
  await assertOwnDocument(session, documentId);
  return prisma.document.update({ where: { id: documentId }, data: input });
}

export async function deleteDocument(session: SessionUser, documentId: string) {
  await assertOwnDocument(session, documentId);
  return prisma.document.delete({ where: { id: documentId } });
}

export async function listDocumentsForVehicle(session: SessionUser, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new DocumentNotFoundError();
  assertCompanyAccess(session, vehicle.companyId);

  return prisma.document.findMany({
    where: { vehicleId },
    orderBy: { expiresAt: "asc" },
  });
}

export async function listDocumentsForDriver(session: SessionUser, driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new DocumentNotFoundError();
  assertCompanyAccess(session, driver.companyId);

  return prisma.document.findMany({
    where: { driverId },
    orderBy: { expiresAt: "asc" },
  });
}

function warningCutoff(now: Date): Date {
  const [year, month, day] = todayKeyInBucharest(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + EXPIRY_WARNING_DAYS));
}

/**
 * One query covers the whole alert: everything expiring on or before the
 * cutoff, which includes anything already expired. Inactive owners are filtered
 * out here rather than in the caller — a sold truck must not nag.
 */
export async function getExpiringDocuments(
  session: SessionUser,
  companyId: string,
  now: Date = new Date()
): Promise<ExpiringDocument[]> {
  assertCompanyAccess(session, companyId);

  const documents = await prisma.document.findMany({
    where: {
      companyId,
      expiresAt: { lte: warningCutoff(now) },
      OR: [{ vehicle: { isActive: true } }, { driver: { isActive: true } }],
    },
    include: {
      vehicle: { select: { id: true, registrationNumber: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { expiresAt: "asc" },
  });

  const rows = documents.map((document) => ({
    id: document.id,
    type: document.type,
    expiresAt: document.expiresAt,
    status: documentStatus(document.expiresAt, now),
    ownerLabel: document.vehicle
      ? document.vehicle.registrationNumber
      : `${document.driver!.firstName} ${document.driver!.lastName}`,
    ownerHref: document.vehicle
      ? `/dashboard/flota/${document.vehicle.id}`
      : `/dashboard/soferi/${document.driver!.id}`,
  }));

  // Expired first, then expiring soon; each group already sorted by date.
  return [
    ...rows.filter((row) => row.status === "EXPIRED"),
    ...rows.filter((row) => row.status === "EXPIRING_SOON"),
  ];
}

/**
 * Aggregate status per owner, for the badge column in the vehicle and driver
 * lists. Includes inactive owners: their page still shows how their documents
 * stood, only the dashboard alert stays quiet about them.
 */
export async function getOwnerStatuses(
  session: SessionUser,
  companyId: string,
  now: Date = new Date()
): Promise<{
  vehicles: Record<string, OwnerDocumentStatus>;
  drivers: Record<string, OwnerDocumentStatus>;
}> {
  assertCompanyAccess(session, companyId);

  const documents = await prisma.document.findMany({
    where: { companyId },
    select: { vehicleId: true, driverId: true, expiresAt: true },
  });

  const byVehicle = new Map<string, DocumentStatus[]>();
  const byDriver = new Map<string, DocumentStatus[]>();

  for (const document of documents) {
    const status = documentStatus(document.expiresAt, now);
    const target = document.vehicleId ? byVehicle : byDriver;
    const key = document.vehicleId ?? document.driverId!;
    target.set(key, [...(target.get(key) ?? []), status]);
  }

  const toRecord = (map: Map<string, DocumentStatus[]>) =>
    Object.fromEntries(
      [...map.entries()].map(([id, statuses]) => [id, aggregateOwnerStatus(statuses)])
    );

  return { vehicles: toRecord(byVehicle), drivers: toRecord(byDriver) };
}
```

- [ ] **Step 4: Rulează testele și verifică tipurile**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/documents.ts tests/data/documents.test.ts
git commit -m "feat: add document data access and expiry alert query"
```

---

## Task 6: Ecrane pentru vehicule

**Files:**
- Create: `app/dashboard/flota/page.tsx`, `app/dashboard/flota/actions.ts`, `app/dashboard/flota/vehicle-form.tsx`, `app/dashboard/flota/nou/page.tsx`, `app/dashboard/flota/[id]/page.tsx`
- Modify: `components/app-shell.tsx`
- Create: `components/document-status-badge.tsx`

**Interfaces:**
- Consumes: `listVehicles`/`getVehicleById`/`createVehicle`/`updateVehicle`/`setVehicleActive`/`DuplicateRegistrationError` (Task 2), `getOwnerStatuses`/`listDocumentsForVehicle` (Task 5), `VEHICLE_TYPE_LABELS`/`OWNER_STATUS_LABELS`/`DOCUMENT_TYPE_LABELS`/`DOCUMENT_STATUS_LABELS`/`documentStatus` (Task 4).
- Produces: `DocumentStatusBadge` component, reused by Task 7 and Task 8.

- [ ] **Step 1: Adaugă intrările în meniul lateral**

Modify `components/app-shell.tsx` — replace the `COMPANY_NAV` constant:

```ts
const COMPANY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/comenzi", label: "Comenzi" },
  { href: "/dashboard/clienti", label: "Clienți" },
  { href: "/dashboard/flota", label: "Flotă" },
  { href: "/dashboard/soferi", label: "Șoferi" },
  { href: "/dashboard/echipa", label: "Echipă", roles: ["COMPANY_ADMIN"] },
];
```

- [ ] **Step 2: Insigna de stare, folosită de toate ecranele**

Write `components/document-status-badge.tsx`:

```tsx
import {
  DOCUMENT_STATUS_LABELS,
  OWNER_STATUS_LABELS,
  type DocumentStatus,
  type OwnerDocumentStatus,
} from "@/lib/documentStatus";

const CLASSES: Record<OwnerDocumentStatus, string> = {
  EXPIRED: "bg-red-100 text-red-900 border-red-300",
  EXPIRING_SOON: "bg-amber-100 text-amber-900 border-amber-300",
  VALID: "bg-emerald-100 text-emerald-900 border-emerald-300",
  NO_DOCUMENTS: "bg-muted text-muted-foreground border-border",
};

export function DocumentStatusBadge({ status }: { status: OwnerDocumentStatus }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${CLASSES[status]}`}
    >
      {OWNER_STATUS_LABELS[status]}
    </span>
  );
}
```

Note the import list above deliberately omits `DOCUMENT_STATUS_LABELS`: `OWNER_STATUS_LABELS` already spreads it, so it covers both a single document's status and an owner's aggregate.

- [ ] **Step 3: Server actions**

Write `app/dashboard/flota/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createVehicle,
  updateVehicle,
  setVehicleActive,
  DuplicateRegistrationError,
  VehicleNotFoundError,
} from "@/lib/data/vehicles";
import { TenantAccessError } from "@/lib/tenancy";
import type { VehicleType } from "@/lib/generated/prisma/enums";

export type VehicleFormState = { error: string | null };

function readFields(formData: FormData) {
  const year = formData.get("manufactureYear") as string;
  return {
    registrationNumber: (formData.get("registrationNumber") as string).trim(),
    type: formData.get("type") as VehicleType,
    make: (formData.get("make") as string) || null,
    model: (formData.get("model") as string) || null,
    manufactureYear: year ? Number(year) : null,
    vin: (formData.get("vin") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createVehicleAction(
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await createVehicle(
      { role: session.user.role, companyId: session.user.companyId },
      { companyId: session.user.companyId, ...readFields(formData) }
    );
  } catch (error) {
    if (error instanceof DuplicateRegistrationError) return { error: error.message };
    throw error;
  }

  revalidatePath("/dashboard/flota");
  redirect("/dashboard/flota");
}

export async function updateVehicleAction(
  vehicleId: string,
  _prevState: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateVehicle(
      { role: session.user.role, companyId: session.user.companyId },
      vehicleId,
      readFields(formData)
    );
  } catch (error) {
    if (error instanceof DuplicateRegistrationError) return { error: error.message };
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof VehicleNotFoundError || error instanceof TenantAccessError) {
      return { error: new VehicleNotFoundError().message };
    }
    throw error;
  }

  revalidatePath(`/dashboard/flota/${vehicleId}`);
  revalidatePath("/dashboard/flota");
  return { error: null };
}

export async function setVehicleActiveAction(vehicleId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await setVehicleActive(
    { role: session.user.role, companyId: session.user.companyId },
    vehicleId,
    isActive
  );

  revalidatePath(`/dashboard/flota/${vehicleId}`);
  revalidatePath("/dashboard/flota");
}
```

- [ ] **Step 4: Formularul reutilizabil, cu câmpuri controlate**

Write `app/dashboard/flota/vehicle-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VEHICLE_TYPE_LABELS } from "@/lib/documentStatus";
import type { VehicleType } from "@/lib/generated/prisma/enums";
import type { VehicleFormState } from "./actions";

type Values = {
  registrationNumber?: string;
  type?: VehicleType;
  make?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  vin?: string | null;
  notes?: string | null;
};

type Fields = {
  registrationNumber: string;
  type: VehicleType;
  make: string;
  model: string;
  manufactureYear: string;
  vin: string;
  notes: string;
};

function toFields(values?: Values): Fields {
  return {
    registrationNumber: values?.registrationNumber ?? "",
    type: values?.type ?? "TRACTOR_UNIT",
    make: values?.make ?? "",
    model: values?.model ?? "",
    // Kept as a string so clearing the field stays empty instead of becoming 0.
    manufactureYear: values?.manufactureYear ? String(values.manufactureYear) : "",
    vin: values?.vin ?? "",
    notes: values?.notes ?? "",
  };
}

export function VehicleForm({
  action,
  values,
  submitLabel,
}: {
  action: (state: VehicleFormState, formData: FormData) => Promise<VehicleFormState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  // Controlled: React 19 resets the form after every action call, which would
  // wipe the user's typing whenever the action returns an error.
  const [fields, setFields] = useState<Fields>(() => toFields(values));

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="registrationNumber">Număr de înmatriculare</Label>
        <Input
          id="registrationNumber"
          name="registrationNumber"
          value={fields.registrationNumber}
          onChange={(e) => update("registrationNumber", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">Tip</Label>
        <select
          id="type"
          name="type"
          value={fields.type}
          onChange={(e) => update("type", e.target.value as VehicleType)}
          className="w-full rounded-lg border px-2 py-2 text-sm"
        >
          {(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map((type) => (
            <option key={type} value={type}>
              {VEHICLE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="make">Marcă</Label>
        <Input id="make" name="make" value={fields.make} onChange={(e) => update("make", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="model">Model</Label>
        <Input id="model" name="model" value={fields.model} onChange={(e) => update("model", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manufactureYear">An fabricație</Label>
        <Input
          id="manufactureYear"
          name="manufactureYear"
          type="number"
          min={1950}
          max={2100}
          value={fields.manufactureYear}
          onChange={(e) => update("manufactureYear", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vin">Serie șasiu</Label>
        <Input id="vin" name="vin" value={fields.vin} onChange={(e) => update("vin", e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Observații</Label>
        <Input id="notes" name="notes" value={fields.notes} onChange={(e) => update("notes", e.target.value)} />
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Pagina de listă**

Write `app/dashboard/flota/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { listVehicles } from "@/lib/data/vehicles";
import { getOwnerStatuses } from "@/lib/data/documents";
import { VEHICLE_TYPE_LABELS } from "@/lib/documentStatus";
import { PageHeader } from "@/components/page-header";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function FlotaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactive?: string }>;
}) {
  const { q, inactive } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const includeInactive = inactive === "1";

  const [vehicles, statuses] = await Promise.all([
    listVehicles(sessionUser, session!.user.companyId!, { search: q, includeInactive }),
    getOwnerStatuses(sessionUser, session!.user.companyId!),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Flotă"
        description="Vehiculele firmei și starea documentelor lor."
        actions={
          <Link href="/dashboard/flota/nou" className={buttonVariants()}>
            Vehicul nou
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-2">
        <Input name="q" placeholder="Caută după număr" defaultValue={q ?? ""} className="max-w-xs" />
        {includeInactive && <input type="hidden" name="inactive" value="1" />}
        <Button type="submit" variant="outline">
          Caută
        </Button>
      </form>

      <p className="mb-4 text-sm">
        <Link
          href={includeInactive ? "/dashboard/flota" : "/dashboard/flota?inactive=1"}
          className="underline"
        >
          {includeInactive ? "Ascunde vehiculele inactive" : "Arată și vehiculele inactive"}
        </Link>
      </p>

      {vehicles.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Niciun vehicul. Adaugă primul vehicul ca să poți urmări documentele lui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Număr</th>
                <th className="px-4 py-2 font-medium">Tip</th>
                <th className="px-4 py-2 font-medium">Marcă / model</th>
                <th className="px-4 py-2 font-medium">Documente</th>
                <th className="px-4 py-2 font-medium">Stare</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/flota/${vehicle.id}`} className="underline">
                      {vehicle.registrationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{VEHICLE_TYPE_LABELS[vehicle.type]}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={statuses.vehicles[vehicle.id] ?? "NO_DOCUMENTS"} />
                  </td>
                  <td className="px-4 py-2">{vehicle.isActive ? "Activ" : "Inactiv"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Pagina de vehicul nou**

Write `app/dashboard/flota/nou/page.tsx`:

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "../vehicle-form";
import { createVehicleAction } from "../actions";

export default function VehiculNouPage() {
  return (
    <div>
      <Link href="/dashboard/flota" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la flotă
      </Link>
      <PageHeader title="Vehicul nou" />
      <VehicleForm action={createVehicleAction} submitLabel="Salvează vehiculul" />
    </div>
  );
}
```

- [ ] **Step 7: Pagina de detaliu**

The documents section is added in Task 8; this task renders the vehicle's own data.

Write `app/dashboard/flota/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getVehicleById } from "@/lib/data/vehicles";
import { VEHICLE_TYPE_LABELS } from "@/lib/documentStatus";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { VehicleForm } from "../vehicle-form";
import { updateVehicleAction, setVehicleActiveAction } from "../actions";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const vehicle = await getVehicleById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!vehicle) notFound();

  const boundUpdate = updateVehicleAction.bind(null, vehicle.id);
  const boundToggle = setVehicleActiveAction.bind(null, vehicle.id, !vehicle.isActive);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/flota" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la flotă
      </Link>

      <PageHeader
        title={vehicle.registrationNumber}
        description={`${VEHICLE_TYPE_LABELS[vehicle.type]}${vehicle.isActive ? "" : " · Inactiv"}`}
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={vehicle.isActive ? "destructive" : "outline"}>
              {vehicle.isActive ? "Dezactivează" : "Reactivează"}
            </Button>
          </form>
        }
      />

      <VehicleForm action={boundUpdate} values={vehicle} submitLabel="Salvează modificările" />
    </div>
  );
}
```

- [ ] **Step 8: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 9: Verifică manual în browser**

Run `npm run dev`, log in as a company user. Confirm: "Flotă" appears in the sidebar; you can create a vehicle of each of the four types; creating a second vehicle with the same registration number shows the Romanian duplicate message **and the form keeps everything you typed**; search by number works; deactivating hides it from the default list and the toggle link reveals it.

- [ ] **Step 10: Commit**

```bash
git add app/dashboard/flota components/app-shell.tsx components/document-status-badge.tsx
git commit -m "feat: add vehicle management screens"
```

---

## Task 7: Ecrane pentru șoferi

**Files:**
- Create: `app/dashboard/soferi/page.tsx`, `app/dashboard/soferi/actions.ts`, `app/dashboard/soferi/driver-form.tsx`, `app/dashboard/soferi/nou/page.tsx`, `app/dashboard/soferi/[id]/page.tsx`

**Interfaces:**
- Consumes: `listDrivers`/`getDriverById`/`createDriver`/`updateDriver`/`setDriverActive`/`DriverNotFoundError` (Task 2), `getOwnerStatuses` (Task 5), `DocumentStatusBadge` (Task 6).

The sidebar entry was already added in Task 6.

- [ ] **Step 1: Server actions**

Write `app/dashboard/soferi/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createDriver,
  updateDriver,
  setDriverActive,
  DriverNotFoundError,
} from "@/lib/data/drivers";
import { TenantAccessError } from "@/lib/tenancy";

export type DriverFormState = { error: string | null };

function readFields(formData: FormData) {
  const hired = formData.get("hiredAt") as string;
  return {
    firstName: (formData.get("firstName") as string).trim(),
    lastName: (formData.get("lastName") as string).trim(),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    personalId: (formData.get("personalId") as string) || null,
    hiredAt: hired ? new Date(hired) : null,
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createDriverAction(
  _prevState: DriverFormState,
  formData: FormData
): Promise<DriverFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await createDriver(
    { role: session.user.role, companyId: session.user.companyId },
    { companyId: session.user.companyId, ...readFields(formData) }
  );

  revalidatePath("/dashboard/soferi");
  redirect("/dashboard/soferi");
}

export async function updateDriverAction(
  driverId: string,
  _prevState: DriverFormState,
  formData: FormData
): Promise<DriverFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateDriver(
      { role: session.user.role, companyId: session.user.companyId },
      driverId,
      readFields(formData)
    );
  } catch (error) {
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof DriverNotFoundError || error instanceof TenantAccessError) {
      return { error: new DriverNotFoundError().message };
    }
    throw error;
  }

  revalidatePath(`/dashboard/soferi/${driverId}`);
  revalidatePath("/dashboard/soferi");
  return { error: null };
}

export async function setDriverActiveAction(driverId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await setDriverActive(
    { role: session.user.role, companyId: session.user.companyId },
    driverId,
    isActive
  );

  revalidatePath(`/dashboard/soferi/${driverId}`);
  revalidatePath("/dashboard/soferi");
}
```

- [ ] **Step 2: Formularul reutilizabil, cu câmpuri controlate**

Write `app/dashboard/soferi/driver-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DriverFormState } from "./actions";

type Values = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  personalId?: string | null;
  hiredAt?: Date | null;
  notes?: string | null;
};

type Fields = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  personalId: string;
  hiredAt: string;
  notes: string;
};

function toFields(values?: Values): Fields {
  return {
    firstName: values?.firstName ?? "",
    lastName: values?.lastName ?? "",
    phone: values?.phone ?? "",
    email: values?.email ?? "",
    personalId: values?.personalId ?? "",
    hiredAt: values?.hiredAt ? values.hiredAt.toISOString().slice(0, 10) : "",
    notes: values?.notes ?? "",
  };
}

export function DriverForm({
  action,
  values,
  submitLabel,
}: {
  action: (state: DriverFormState, formData: FormData) => Promise<DriverFormState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  // Controlled, for the same React 19 reset reason as every other form here.
  const [fields, setFields] = useState<Fields>(() => toFields(values));

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="lastName">Nume</Label>
        <Input
          id="lastName"
          name="lastName"
          value={fields.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="firstName">Prenume</Label>
        <Input
          id="firstName"
          name="firstName"
          value={fields.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefon</Label>
        <Input id="phone" name="phone" value={fields.phone} onChange={(e) => update("phone", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={fields.email}
          onChange={(e) => update("email", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hiredAt">Data angajării</Label>
        <Input
          id="hiredAt"
          name="hiredAt"
          type="date"
          value={fields.hiredAt}
          onChange={(e) => update("hiredAt", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="personalId">CNP (opțional)</Label>
        <Input
          id="personalId"
          name="personalId"
          value={fields.personalId}
          onChange={(e) => update("personalId", e.target.value)}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Observații</Label>
        <Input id="notes" name="notes" value={fields.notes} onChange={(e) => update("notes", e.target.value)} />
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Pagina de listă**

Write `app/dashboard/soferi/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { listDrivers } from "@/lib/data/drivers";
import { getOwnerStatuses } from "@/lib/data/documents";
import { PageHeader } from "@/components/page-header";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function SoferiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactive?: string }>;
}) {
  const { q, inactive } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const includeInactive = inactive === "1";

  const [drivers, statuses] = await Promise.all([
    listDrivers(sessionUser, session!.user.companyId!, { search: q, includeInactive }),
    getOwnerStatuses(sessionUser, session!.user.companyId!),
  ]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Șoferi"
        description="Șoferii firmei și starea documentelor lor."
        actions={
          <Link href="/dashboard/soferi/nou" className={buttonVariants()}>
            Șofer nou
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-2">
        <Input name="q" placeholder="Caută după nume" defaultValue={q ?? ""} className="max-w-xs" />
        {includeInactive && <input type="hidden" name="inactive" value="1" />}
        <Button type="submit" variant="outline">
          Caută
        </Button>
      </form>

      <p className="mb-4 text-sm">
        <Link
          href={includeInactive ? "/dashboard/soferi" : "/dashboard/soferi?inactive=1"}
          className="underline"
        >
          {includeInactive ? "Ascunde șoferii inactivi" : "Arată și șoferii inactivi"}
        </Link>
      </p>

      {drivers.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Niciun șofer. Adaugă primul șofer ca să poți urmări documentele lui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Nume</th>
                <th className="px-4 py-2 font-medium">Telefon</th>
                <th className="px-4 py-2 font-medium">Documente</th>
                <th className="px-4 py-2 font-medium">Stare</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/soferi/${driver.id}`} className="underline">
                      {driver.lastName} {driver.firstName}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{driver.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={statuses.drivers[driver.id] ?? "NO_DOCUMENTS"} />
                  </td>
                  <td className="px-4 py-2">{driver.isActive ? "Activ" : "Inactiv"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pagina de șofer nou**

Write `app/dashboard/soferi/nou/page.tsx`:

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DriverForm } from "../driver-form";
import { createDriverAction } from "../actions";

export default function SoferNouPage() {
  return (
    <div>
      <Link href="/dashboard/soferi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la șoferi
      </Link>
      <PageHeader title="Șofer nou" />
      <DriverForm action={createDriverAction} submitLabel="Salvează șoferul" />
    </div>
  );
}
```

- [ ] **Step 5: Pagina de detaliu**

Write `app/dashboard/soferi/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDriverById } from "@/lib/data/drivers";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DriverForm } from "../driver-form";
import { updateDriverAction, setDriverActiveAction } from "../actions";

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const driver = await getDriverById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!driver) notFound();

  const boundUpdate = updateDriverAction.bind(null, driver.id);
  const boundToggle = setDriverActiveAction.bind(null, driver.id, !driver.isActive);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/soferi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la șoferi
      </Link>

      <PageHeader
        title={`${driver.lastName} ${driver.firstName}`}
        description={driver.isActive ? undefined : "Inactiv"}
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={driver.isActive ? "destructive" : "outline"}>
              {driver.isActive ? "Dezactivează" : "Reactivează"}
            </Button>
          </form>
        }
      />

      <DriverForm action={boundUpdate} values={driver} submitLabel="Salvează modificările" />
    </div>
  );
}
```

- [ ] **Step 6: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 7: Verifică manual**

Create a driver, edit them, deactivate and reactivate. Confirm the CNP field is optional and that leaving it empty saves fine.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/soferi
git commit -m "feat: add driver management screens"
```

---

## Task 8: Documentele pe fișa proprietarului

**Files:**
- Create: `components/documents-section.tsx`, `app/dashboard/documente/actions.ts`
- Modify: `app/dashboard/flota/[id]/page.tsx`, `app/dashboard/soferi/[id]/page.tsx`

**Interfaces:**
- Consumes: `createDocument`/`updateDocument`/`deleteDocument`/`listDocumentsForVehicle`/`listDocumentsForDriver`/`InvalidDocumentOwnerError`/`DocumentNotFoundError` (Task 5), `documentStatus`/`DOCUMENT_TYPE_LABELS`/`VEHICLE_DOCUMENT_TYPES`/`DRIVER_DOCUMENT_TYPES` (Task 4), `DocumentStatusBadge` (Task 6).
- Produces: `DocumentsSection` component, used by both detail pages.

- [ ] **Step 1: Server actions pentru documente**

Both owner types share one action file, because the document operations are identical either way.

Write `app/dashboard/documente/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createDocument,
  updateDocument,
  deleteDocument,
  InvalidDocumentOwnerError,
  DocumentNotFoundError,
} from "@/lib/data/documents";
import { TenantAccessError } from "@/lib/tenancy";
import type { DocumentType } from "@/lib/generated/prisma/enums";

export type DocumentFormState = { error: string | null };

function parseDate(value: FormDataEntryValue | null): Date | null {
  const text = value as string;
  if (!text) return null;
  // A date input gives "YYYY-MM-DD"; anchoring at UTC midnight keeps the stored
  // calendar day identical to what the user picked.
  return new Date(`${text}T00:00:00Z`);
}

function ownerPath(formData: FormData) {
  const vehicleId = (formData.get("vehicleId") as string) || null;
  const driverId = (formData.get("driverId") as string) || null;
  return vehicleId ? `/dashboard/flota/${vehicleId}` : `/dashboard/soferi/${driverId}`;
}

export async function createDocumentAction(
  _prevState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const expiresAt = parseDate(formData.get("expiresAt"));
  if (!expiresAt) return { error: "Data de expirare este obligatorie." };

  try {
    await createDocument(
      { role: session.user.role, companyId: session.user.companyId },
      {
        vehicleId: (formData.get("vehicleId") as string) || undefined,
        driverId: (formData.get("driverId") as string) || undefined,
        type: formData.get("type") as DocumentType,
        number: (formData.get("number") as string) || null,
        issuedAt: parseDate(formData.get("issuedAt")),
        expiresAt,
        notes: (formData.get("notes") as string) || null,
      }
    );
  } catch (error) {
    if (error instanceof InvalidDocumentOwnerError) return { error: error.message };
    if (error instanceof TenantAccessError) {
      return { error: "Proprietarul documentului nu a fost găsit." };
    }
    throw error;
  }

  revalidatePath(ownerPath(formData));
  revalidatePath("/dashboard");
  return { error: null };
}

/**
 * Renewal is the only edit the spec calls for: a new ITP means a new expiry
 * date on the same document. It deliberately touches ONLY `expiresAt` — passing
 * the other fields would blank whatever the row form does not resubmit. A
 * document entered wrongly is deleted and re-added instead.
 */
export async function renewDocumentAction(
  documentId: string,
  ownerPathValue: string,
  _prevState: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const expiresAt = parseDate(formData.get("expiresAt"));
  if (!expiresAt) return { error: "Data de expirare este obligatorie." };

  try {
    await updateDocument(
      { role: session.user.role, companyId: session.user.companyId },
      documentId,
      { expiresAt }
    );
  } catch (error) {
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof DocumentNotFoundError || error instanceof TenantAccessError) {
      return { error: new DocumentNotFoundError().message };
    }
    throw error;
  }

  revalidatePath(ownerPathValue);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteDocumentAction(documentId: string, ownerPathValue: string) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await deleteDocument(
    { role: session.user.role, companyId: session.user.companyId },
    documentId
  );

  revalidatePath(ownerPathValue);
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Componenta de documente**

Write `components/documents-section.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { DOCUMENT_TYPE_LABELS, type DocumentStatus } from "@/lib/documentStatus";
import type { DocumentType } from "@/lib/generated/prisma/enums";
import {
  createDocumentAction,
  deleteDocumentAction,
  renewDocumentAction,
  type DocumentFormState,
} from "@/app/dashboard/documente/actions";

export type DocumentRow = {
  id: string;
  type: DocumentType;
  number: string | null;
  issuedAt: string | null;
  expiresAt: string;
  status: DocumentStatus;
};

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Renewal in place, one row at a time. Its own component so each row keeps its
 * own action state — a shared one would show another row's error.
 */
function DocumentRenewal({
  documentId,
  ownerPath,
  currentExpiry,
}: {
  documentId: string;
  ownerPath: string;
  currentExpiry: string;
}) {
  const boundAction = renewDocumentAction.bind(null, documentId, ownerPath);
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(boundAction, {
    error: null,
  });
  const [expiresAt, setExpiresAt] = useState(currentExpiry);

  return (
    <form action={formAction} className="flex items-center gap-1">
      <Input
        name="expiresAt"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        required
        className="w-36"
        aria-label="Noua dată de expirare"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Reînnoiește"}
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function DocumentsSection({
  ownerKind,
  ownerId,
  ownerPath,
  availableTypes,
  documents,
}: {
  ownerKind: "vehicle" | "driver";
  ownerId: string;
  ownerPath: string;
  availableTypes: readonly DocumentType[];
  documents: DocumentRow[];
}) {
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(
    createDocumentAction,
    { error: null }
  );

  // Controlled, so a rejected submit does not wipe what was typed.
  const [type, setType] = useState<DocumentType>(availableTypes[0]);
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-medium">Documente</h2>

      {documents.length === 0 ? (
        <p className="text-muted-foreground mb-6 rounded-lg border border-dashed p-6 text-center text-sm">
          Niciun document înregistrat.
        </p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Tip</th>
                <th className="px-4 py-2 font-medium">Număr</th>
                <th className="px-4 py-2 font-medium">Expiră</th>
                <th className="px-4 py-2 font-medium">Stare</th>
                <th className="px-4 py-2 font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{DOCUMENT_TYPE_LABELS[document.type]}</td>
                  <td className="text-muted-foreground px-4 py-2">{document.number ?? "—"}</td>
                  <td className="px-4 py-2">{formatDate(document.expiresAt)}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={document.status} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <DocumentRenewal
                        documentId={document.id}
                        ownerPath={ownerPath}
                        currentExpiry={document.expiresAt}
                      />
                      <form action={deleteDocumentAction.bind(null, document.id, ownerPath)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                          onClick={(event) => {
                            if (!window.confirm("Ștergi acest document?")) event.preventDefault();
                          }}
                        >
                          Șterge
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mb-3 text-sm font-medium">Adaugă un document</h3>
      <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <input
          type="hidden"
          name={ownerKind === "vehicle" ? "vehicleId" : "driverId"}
          value={ownerId}
        />

        <div className="space-y-1.5">
          <Label htmlFor="type">Tip document</Label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className="w-full rounded-lg border px-2 py-2 text-sm"
          >
            {availableTypes.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="number">Număr / serie</Label>
          <Input id="number" name="number" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issuedAt">Data emiterii</Label>
          <Input
            id="issuedAt"
            name="issuedAt"
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiresAt">Data expirării</Label>
          <Input
            id="expiresAt"
            name="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            required
          />
        </div>

        {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Se salvează..." : "Adaugă documentul"}
          </Button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 3: Adaugă secțiunea pe fișa vehiculului**

Modify `app/dashboard/flota/[id]/page.tsx` — add these imports next to the existing ones:

```tsx
import { listDocumentsForVehicle } from "@/lib/data/documents";
import { documentStatus, VEHICLE_DOCUMENT_TYPES, toDateKey } from "@/lib/documentStatus";
import { DocumentsSection } from "@/components/documents-section";
```

After `if (!vehicle) notFound();`, add:

```tsx
  const documents = (
    await listDocumentsForVehicle(
      { role: session!.user.role, companyId: session!.user.companyId },
      vehicle.id
    )
  ).map((document) => ({
    id: document.id,
    type: document.type,
    number: document.number,
    issuedAt: document.issuedAt ? toDateKey(document.issuedAt) : null,
    expiresAt: toDateKey(document.expiresAt),
    status: documentStatus(document.expiresAt),
  }));
```

And append immediately before the closing `</div>` of the page:

```tsx
      <DocumentsSection
        ownerKind="vehicle"
        ownerId={vehicle.id}
        ownerPath={`/dashboard/flota/${vehicle.id}`}
        availableTypes={VEHICLE_DOCUMENT_TYPES}
        documents={documents}
      />
```

- [ ] **Step 4: Adaugă secțiunea pe fișa șoferului**

Modify `app/dashboard/soferi/[id]/page.tsx` — add these imports:

```tsx
import { listDocumentsForDriver } from "@/lib/data/documents";
import { documentStatus, DRIVER_DOCUMENT_TYPES, toDateKey } from "@/lib/documentStatus";
import { DocumentsSection } from "@/components/documents-section";
```

After `if (!driver) notFound();`, add:

```tsx
  const documents = (
    await listDocumentsForDriver(
      { role: session!.user.role, companyId: session!.user.companyId },
      driver.id
    )
  ).map((document) => ({
    id: document.id,
    type: document.type,
    number: document.number,
    issuedAt: document.issuedAt ? toDateKey(document.issuedAt) : null,
    expiresAt: toDateKey(document.expiresAt),
    status: documentStatus(document.expiresAt),
  }));
```

And append immediately before the closing `</div>`:

```tsx
      <DocumentsSection
        ownerKind="driver"
        ownerId={driver.id}
        ownerPath={`/dashboard/soferi/${driver.id}`}
        availableTypes={DRIVER_DOCUMENT_TYPES}
        documents={documents}
      />
```

- [ ] **Step 5: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 6: Verifică manual**

Add an ITP expiring next week to a vehicle and confirm the amber badge appears; add an already-expired RCA and confirm red. Renew one by setting its date a year out and confirm the row's badge turns green without touching its type or number. Delete one and confirm the confirmation prompt appears and the row disappears. On a driver, confirm the type list offers only driver document types. Finally, submit the add-document form with the expiry date left empty and confirm the Romanian error appears **and the other fields keep what you typed**.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/documente components/documents-section.tsx app/dashboard/flota app/dashboard/soferi
git commit -m "feat: manage documents from the vehicle and driver pages"
```

---

## Task 9: Alertele pe dashboard

**Files:**
- Modify: `app/dashboard/page.tsx`
- Create: `components/expiry-alerts.tsx`

**Interfaces:**
- Consumes: `getExpiringDocuments` (Task 5), `DOCUMENT_TYPE_LABELS`/`EXPIRY_WARNING_DAYS`/`toDateKey` (Task 4), `DocumentStatusBadge` (Task 6).

- [ ] **Step 1: Componenta de alerte**

Write `components/expiry-alerts.tsx`:

```tsx
import Link from "next/link";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import {
  DOCUMENT_TYPE_LABELS,
  EXPIRY_WARNING_DAYS,
  type DocumentStatus,
} from "@/lib/documentStatus";
import type { DocumentType } from "@/lib/generated/prisma/enums";

export type ExpiryAlertRow = {
  id: string;
  type: DocumentType;
  expiresAt: string;
  status: DocumentStatus;
  ownerLabel: string;
  ownerHref: string;
};

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function ExpiryAlerts({ rows }: { rows: ExpiryAlertRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium">Documente care expiră</h2>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Toate documentele sunt în regulă. Nimic nu expiră în următoarele{" "}
          {EXPIRY_WARNING_DAYS} de zile.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Document</th>
                <th className="px-4 py-2 font-medium">Pentru</th>
                <th className="px-4 py-2 font-medium">Expiră</th>
                <th className="px-4 py-2 font-medium">Stare</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{DOCUMENT_TYPE_LABELS[row.type]}</td>
                  <td className="px-4 py-2">
                    <Link href={row.ownerHref} className="underline">
                      {row.ownerLabel}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatDate(row.expiresAt)}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Adaugă alertele pe dashboard**

Write `app/dashboard/page.tsx` (replacing the whole file):

```tsx
import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { getExpiringDocuments } from "@/lib/data/documents";
import { toDateKey } from "@/lib/documentStatus";
import { PageHeader } from "@/components/page-header";
import { ExpiryAlerts } from "@/components/expiry-alerts";

export default async function DashboardPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };

  const [company, expiring] = await Promise.all([
    getCompanyForSession(sessionUser),
    getExpiringDocuments(sessionUser, session!.user.companyId!),
  ]);

  const rows = expiring.map((document) => ({
    id: document.id,
    type: document.type,
    expiresAt: toDateKey(document.expiresAt),
    status: document.status,
    ownerLabel: document.ownerLabel,
    ownerHref: document.ownerHref,
  }));

  return (
    <div className="max-w-4xl">
      <PageHeader title={`Bine ai venit, ${session!.user.name}`} description={company?.name} />

      {company?.status === "TRIAL" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Firma ta este în așteptare de activare. Vei fi contactat în curând.
        </div>
      )}

      <ExpiryAlerts rows={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 4: Verifică manual**

With an expired document and one expiring within 30 days, confirm the dashboard lists the expired one first, that clicking the owner link opens its page, and that deactivating that owner makes the row disappear. Delete the remaining alerting documents and confirm the green "totul e în regulă" message replaces the table.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx components/expiry-alerts.tsx
git commit -m "feat: show document expiry alerts on the dashboard"
```

---

## Task 10: Checklist final de testare manuală

No new code — end-to-end verification of the whole module, run locally or on production.

- [ ] Adaugă un vehicul de fiecare tip: cap tractor, semiremorcă, autocamion, dubă 3.5t
- [ ] Încearcă un al doilea vehicul cu același număr de înmatriculare; confirmă mesajul în română **și** că formularul păstrează ce ai scris
- [ ] Caută un vehicul după o parte din număr
- [ ] Adaugă un șofer fără CNP; confirmă că se salvează
- [ ] Adaugă unui vehicul un ITP expirat de o săptămână și un RCA care expiră peste 10 zile
- [ ] Adaugă unui șofer un permis care expiră peste 20 de zile
- [ ] Pe lista Flotă, confirmă insigna roșie pe vehiculul respectiv; pe Șoferi, insigna galbenă
- [ ] Pe dashboard, confirmă că apar toate trei, **expiratul primul**, fiecare cu linkul către proprietar
- [ ] Dezactivează vehiculul; confirmă că cele două documente ale lui dispar din alertele de pe dashboard, dar rămân vizibile pe fișa lui
- [ ] Reactivează-l; confirmă că alertele revin
- [ ] Reînnoiește ITP-ul (schimbă data de expirare peste un an); confirmă că iese din alerte și insigna devine verde
- [ ] Șterge un document; confirmă că apare întrebarea de confirmare și că rândul dispare
- [ ] Adaugă un vehicul fără niciun document; confirmă că insigna lui spune „Fără documente", nu „În regulă"
- [ ] Loghează-te cu a doua firmă; confirmă că nu vezi niciun vehicul, șofer sau alertă a primei firme
- [ ] Fiind logat cu a doua firmă, deschide manual adresa unui vehicul al primei firme; confirmă 404
