# ONE x TMS — Modulul 2: Clienți & Comenzi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client records and transport orders with multi-stop routes, per-company yearly order numbering, BNR-frozen RON equivalents for EUR pricing, and a seven-state order lifecycle.

**Architecture:** Extends the existing Next.js 16 App Router monolith. New Prisma models (`Client`, `Order`, `OrderStop`) follow the established tenant pattern: every row carries `companyId`, and every data-access function takes `SessionUser` first and calls `assertCompanyAccess` before touching the database. Pure logic (status transitions, BNR XML parsing, money arithmetic) lives in separate testable modules with no database or network dependency, so the test suite stays fast and deterministic.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`), PostgreSQL (Neon), Auth.js v5, Tailwind CSS v4, shadcn/ui, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-17-one-x-tms-orders-design.md](../specs/2026-08-17-one-x-tms-orders-design.md)

## Global Constraints

- All user-facing text (labels, buttons, error messages, status names) is in Romanian. Enum values in code stay English, matching `CompanyStatus`/`UserRole` from the foundation.
- Every function that reads or writes company-scoped data MUST call `assertCompanyAccess(session, companyId)` from `lib/tenancy.ts` before the query. This is the core security invariant of the product — no exceptions, including for `Client`, `Order`, and `OrderStop`.
- Cross-tenant access returns **404**, never 403 — a 403 confirms the resource exists to a company that must not know that.
- Money is stored as `Decimal` and manipulated with `Prisma.Decimal` (decimal.js) — never JavaScript `number` arithmetic, which loses cents.
- `salePriceRon` is frozen at creation: editing the price later recalculates it using the **stored** `exchangeRate`, never a fresh rate.
- Orders are never deleted; clients are never deleted (deactivated via `isActive = false`).
- TypeScript strict mode; no `any`.
- Prisma imports: enums from `@/lib/generated/prisma/enums`, model types from `@/lib/generated/prisma/models` (suffixed `Model`, e.g. `ClientModel`), `Prisma` namespace from `@/lib/generated/prisma/client`.
- No placeholder code, no `TODO` — every task ships working, tested code.

---

## Task 1: Model Client + migrare

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_client/migration.sql` (generated)

**Interfaces:**
- Produces: `Client` model and `ClientModel` type, consumed by every later task in Stage A and by order creation in Task 7.

- [ ] **Step 1: Adaugă modelul în schemă**

Modify `prisma/schema.prisma` — add at the end of the file:

```prisma
model Client {
  id              String   @id @default(cuid())
  companyId       String
  name            String
  cui             String
  address         String
  city            String
  country         String   @default("România")
  contactName     String?
  contactPhone    String?
  contactEmail    String?
  paymentTermDays Int      @default(45)
  isActive        Boolean  @default(true)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id])

  @@index([companyId, name])
}
```

Also add the back-relation to the existing `Company` model — inside `model Company`, next to `users` and `invitations`:

```prisma
  clients     Client[]
```

- [ ] **Step 2: Rulează migrarea pe baza de dezvoltare**

Run: `npx prisma migrate dev --name add_client`
Expected: migration applies, `Client` table created.

- [ ] **Step 3: Aplică migrarea și pe baza de test**

The test suite runs against a separate database; new tables must exist there too or every later test fails with "table does not exist".

Run (PowerShell):
```bash
$env:DATABASE_URL=(Get-Content .env.test | Select-String 'DATABASE_URL' | ForEach-Object { $_ -replace 'DATABASE_URL=','' -replace '"','' }); npx prisma migrate deploy
```

Run (bash):
```bash
DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d'"' -f2) npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 4: Extinde curățarea bazei de test**

`resetDatabase` deletes companies, and `Client` rows reference them. Without
this change, the very first test that creates a client fails on a foreign-key
violation when the next test tries to clear companies.

Modify `tests/helpers/db.ts` — replace the body of `resetDatabase`:

```ts
export async function resetDatabase() {
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
```

- [ ] **Step 5: Regenerează clientul Prisma, verifică tipurile și testele**

Run: `npx prisma generate && npx tsc --noEmit && npm test`
Expected: `tsc` silent, existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/ tests/helpers/db.ts
git commit -m "feat: add Client model"
```

---

## Task 2: Acces la date pentru clienți

**Files:**
- Create: `lib/data/clients.ts`
- Test: `tests/data/clients.test.ts`

**Interfaces:**
- Consumes: `prisma` (`lib/prisma.ts`), `assertCompanyAccess`/`SessionUser`/`TenantAccessError` (`lib/tenancy.ts`), `ClientModel` (Task 1).
- Produces:
  - `listClients(session: SessionUser, companyId: string, options?: { search?: string; includeInactive?: boolean }): Promise<ClientModel[]>`
  - `getClientById(session: SessionUser, clientId: string): Promise<ClientModel | null>`
  - `createClient(session: SessionUser, input: CreateClientInput): Promise<ClientModel>`
  - `updateClient(session: SessionUser, clientId: string, input: UpdateClientInput): Promise<ClientModel>`
  - `setClientActive(session: SessionUser, clientId: string, isActive: boolean): Promise<ClientModel>`
  - `findClientsByCui(session: SessionUser, companyId: string, cui: string): Promise<ClientModel[]>`
  - types `CreateClientInput`, `UpdateClientInput`
  - class `DuplicateCuiError` (carries `existingClientName`)

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/clients.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  listClients,
  getClientById,
  createClient,
  updateClient,
  setClientActive,
  DuplicateCuiError,
} from "@/lib/data/clients";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

const baseInput = {
  name: "Marfa Rapida SRL",
  cui: "RO111",
  address: "Str. Depozitelor 1",
  city: "Ploiești",
};

describe("createClient", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un client activ cu termen de plată implicit 45", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const client = await createClient(session, { ...baseInput, companyId: company.id });

    expect(client.isActive).toBe(true);
    expect(client.paymentTermDays).toBe(45);
    expect(client.country).toBe("România");
    expect(client.companyId).toBe(company.id);
  });

  it("respinge crearea unui client pentru altă firmă", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");
    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };

    await expect(
      createClient(session, { ...baseInput, companyId: companyB.id })
    ).rejects.toThrow(TenantAccessError);
  });

  it("respinge un CUI deja folosit în aceeași firmă, fără confirmare", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createClient(session, { ...baseInput, companyId: company.id });

    await expect(
      createClient(session, { ...baseInput, companyId: company.id, name: "Alt nume" })
    ).rejects.toThrow(DuplicateCuiError);
  });

  it("acceptă CUI duplicat când se confirmă explicit", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createClient(session, { ...baseInput, companyId: company.id });

    const second = await createClient(session, {
      ...baseInput,
      companyId: company.id,
      name: "Alt nume",
      confirmDuplicateCui: true,
    });

    expect(second.name).toBe("Alt nume");
  });

  it("permite același CUI în firme diferite fără confirmare", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");

    await createClient(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      { ...baseInput, companyId: companyA.id }
    );
    const clientB = await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id }
    );

    expect(clientB.companyId).toBe(companyB.id);
  });
});

describe("listClients", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar clienții firmei cerute", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");

    await createClient(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      { ...baseInput, companyId: companyA.id, name: "Client A" }
    );
    await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id, name: "Client B" }
    );

    const result = await listClients(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      companyA.id
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Client A");
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");

    await expect(
      listClients({ role: "COMPANY_ADMIN", companyId: companyA.id }, companyB.id)
    ).rejects.toThrow(TenantAccessError);
  });

  it("ascunde clienții inactivi implicit și îi arată la cerere", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const client = await createClient(session, { ...baseInput, companyId: company.id });
    await setClientActive(session, client.id, false);

    expect(await listClients(session, company.id)).toHaveLength(0);
    expect(await listClients(session, company.id, { includeInactive: true })).toHaveLength(1);
  });

  it("caută după nume și după CUI", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createClient(session, { ...baseInput, companyId: company.id, name: "Alfa Trans", cui: "RO999" });
    await createClient(session, { ...baseInput, companyId: company.id, name: "Beta Log", cui: "RO888" });

    expect(await listClients(session, company.id, { search: "alfa" })).toHaveLength(1);
    expect(await listClients(session, company.id, { search: "888" })).toHaveLength(1);
  });
});

describe("getClientById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru un client din altă firmă, fără să arunce", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");
    const clientB = await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id }
    );

    const result = await getClientById(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      clientB.id
    );

    expect(result).toBeNull();
  });
});

describe("updateClient", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge modificarea unui client din altă firmă", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");
    const clientB = await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id }
    );

    await expect(
      updateClient({ role: "COMPANY_ADMIN", companyId: companyA.id }, clientB.id, {
        name: "Furat",
      })
    ).rejects.toThrow(TenantAccessError);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/clients.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/data/clients.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export class DuplicateCuiError extends Error {
  existingClientName: string;

  constructor(existingClientName: string) {
    super(`Există deja un client cu acest CUI: ${existingClientName}.`);
    this.name = "DuplicateCuiError";
    this.existingClientName = existingClientName;
  }
}

export type CreateClientInput = {
  companyId: string;
  name: string;
  cui: string;
  address: string;
  city: string;
  country?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  paymentTermDays?: number;
  notes?: string | null;
  /** Set by the UI on the second submit, after the user accepts the duplicate warning. */
  confirmDuplicateCui?: boolean;
};

export type UpdateClientInput = Partial<
  Omit<CreateClientInput, "companyId" | "confirmDuplicateCui">
>;

export async function findClientsByCui(
  session: SessionUser,
  companyId: string,
  cui: string
) {
  assertCompanyAccess(session, companyId);
  return prisma.client.findMany({ where: { companyId, cui } });
}

export async function listClients(
  session: SessionUser,
  companyId: string,
  options: { search?: string; includeInactive?: boolean } = {}
) {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.client.findMany({
    where: {
      companyId,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { cui: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getClientById(session: SessionUser, clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return null;
  // Returns null rather than throwing so pages can render a 404 without
  // distinguishing "does not exist" from "belongs to another company".
  if (session.role !== "SUPER_ADMIN" && client.companyId !== session.companyId) {
    return null;
  }
  return client;
}

export async function createClient(session: SessionUser, input: CreateClientInput) {
  assertCompanyAccess(session, input.companyId);

  if (!input.confirmDuplicateCui) {
    const existing = await findClientsByCui(session, input.companyId, input.cui);
    if (existing.length > 0) {
      throw new DuplicateCuiError(existing[0].name);
    }
  }

  return prisma.client.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      cui: input.cui,
      address: input.address,
      city: input.city,
      country: input.country ?? "România",
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      paymentTermDays: input.paymentTermDays ?? 45,
      notes: input.notes ?? null,
    },
  });
}

async function assertOwnClient(session: SessionUser, clientId: string) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  assertCompanyAccess(session, client.companyId);
  return client;
}

export async function updateClient(
  session: SessionUser,
  clientId: string,
  input: UpdateClientInput
) {
  await assertOwnClient(session, clientId);
  return prisma.client.update({ where: { id: clientId }, data: input });
}

export async function setClientActive(
  session: SessionUser,
  clientId: string,
  isActive: boolean
) {
  await assertOwnClient(session, clientId);
  return prisma.client.update({ where: { id: clientId }, data: { isActive } });
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/clients.ts tests/data/clients.test.ts
git commit -m "feat: add tenant-scoped client data access"
```

---

## Task 3: Ecrane pentru clienți

**Files:**
- Create: `app/dashboard/clienti/page.tsx`, `app/dashboard/clienti/actions.ts`, `app/dashboard/clienti/client-form.tsx`, `app/dashboard/clienti/nou/page.tsx`, `app/dashboard/clienti/[id]/page.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `listClients`, `getClientById`, `createClient`, `updateClient`, `setClientActive`, `DuplicateCuiError`, `CreateClientInput` (Task 2); `auth` (`@/auth`); `PageHeader`, `Button`, `Input`, `Badge`.
- Produces: `ClientForm` component, reused by the "new" and "edit" pages.

- [ ] **Step 1: Adaugă intrarea în meniul lateral**

Modify `components/app-shell.tsx` — replace the `COMPANY_NAV` constant:

```ts
const COMPANY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/clienti", label: "Clienți" },
  { href: "/dashboard/echipa", label: "Echipă", roles: ["COMPANY_ADMIN"] },
];
```

- [ ] **Step 2: Server actions**

Write `app/dashboard/clienti/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createClient,
  updateClient,
  setClientActive,
  DuplicateCuiError,
} from "@/lib/data/clients";

export type ClientFormState = {
  error: string | null;
  duplicateWarning: string | null;
};

function readClientFields(formData: FormData) {
  return {
    name: formData.get("name") as string,
    cui: formData.get("cui") as string,
    address: formData.get("address") as string,
    city: formData.get("city") as string,
    country: (formData.get("country") as string) || "România",
    contactName: (formData.get("contactName") as string) || null,
    contactPhone: (formData.get("contactPhone") as string) || null,
    contactEmail: (formData.get("contactEmail") as string) || null,
    paymentTermDays: Number(formData.get("paymentTermDays") || 45),
    notes: (formData.get("notes") as string) || null,
  };
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const sessionUser = { role: session.user.role, companyId: session.user.companyId };

  try {
    await createClient(sessionUser, {
      companyId: session.user.companyId,
      ...readClientFields(formData),
      confirmDuplicateCui: formData.get("confirmDuplicateCui") === "true",
    });
  } catch (error) {
    if (error instanceof DuplicateCuiError) {
      return { error: null, duplicateWarning: error.message };
    }
    throw error;
  }

  revalidatePath("/dashboard/clienti");
  redirect("/dashboard/clienti");
}

export async function updateClientAction(
  clientId: string,
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await updateClient(
    { role: session.user.role, companyId: session.user.companyId },
    clientId,
    readClientFields(formData)
  );

  revalidatePath(`/dashboard/clienti/${clientId}`);
  revalidatePath("/dashboard/clienti");
  return { error: null, duplicateWarning: null };
}

export async function setClientActiveAction(clientId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await setClientActive(
    { role: session.user.role, companyId: session.user.companyId },
    clientId,
    isActive
  );

  revalidatePath(`/dashboard/clienti/${clientId}`);
  revalidatePath("/dashboard/clienti");
}
```

- [ ] **Step 3: Formularul reutilizabil**

Write `app/dashboard/clienti/client-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientFormState } from "./actions";

type Values = {
  name?: string;
  cui?: string;
  address?: string;
  city?: string;
  country?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  paymentTermDays?: number;
  notes?: string | null;
};

export function ClientForm({
  action,
  values,
  submitLabel,
}: {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    duplicateWarning: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume firmă</Label>
          <Input id="name" name="name" defaultValue={values?.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cui">CUI</Label>
          <Input id="cui" name="cui" defaultValue={values?.cui} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Adresă</Label>
          <Input id="address" name="address" defaultValue={values?.address} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Oraș</Label>
          <Input id="city" name="city" defaultValue={values?.city} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Țară</Label>
          <Input id="country" name="country" defaultValue={values?.country ?? "România"} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentTermDays">Termen de plată (zile)</Label>
          <Input
            id="paymentTermDays"
            name="paymentTermDays"
            type="number"
            min={0}
            defaultValue={values?.paymentTermDays ?? 45}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Persoană de contact</Label>
          <Input id="contactName" name="contactName" defaultValue={values?.contactName ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Telefon</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={values?.contactPhone ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Email</Label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={values?.contactEmail ?? ""}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Observații</Label>
          <Input id="notes" name="notes" defaultValue={values?.notes ?? ""} />
        </div>
      </div>

      {state.duplicateWarning && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{state.duplicateWarning}</p>
          {/* Resubmits the same fields with the confirmation flag set. */}
          <input type="hidden" name="confirmDuplicateCui" value="true" />
          <p className="text-xs">Apasă din nou pe buton pentru a-l adăuga oricum.</p>
        </div>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Pagina de listă**

Write `app/dashboard/clienti/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactivi?: string }>;
}) {
  const { q, inactivi } = await searchParams;
  const session = await auth();
  const includeInactive = inactivi === "1";

  const clients = await listClients(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { search: q, includeInactive }
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Clienți"
        description="Firmele care îți trimit comenzi de transport."
        actions={
          // This project's Button is built on Base UI, which has no `asChild`;
          // styling the Link with buttonVariants is the supported way.
          <Link href="/dashboard/clienti/nou" className={buttonVariants()}>
            Client nou
          </Link>
        }
      />

      <form className="mb-4 flex items-center gap-2">
        <Input name="q" placeholder="Caută după nume sau CUI" defaultValue={q ?? ""} />
        {includeInactive && <input type="hidden" name="inactivi" value="1" />}
        <Button type="submit" variant="outline">
          Caută
        </Button>
      </form>

      <p className="mb-4 text-sm">
        <Link
          href={includeInactive ? "/dashboard/clienti" : "/dashboard/clienti?inactivi=1"}
          className="underline"
        >
          {includeInactive ? "Ascunde clienții inactivi" : "Arată și clienții inactivi"}
        </Link>
      </p>

      {clients.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Niciun client. Adaugă primul client ca să poți crea comenzi.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Nume</th>
                <th className="px-4 py-2 font-medium">CUI</th>
                <th className="px-4 py-2 font-medium">Oraș</th>
                <th className="px-4 py-2 font-medium">Termen plată</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/clienti/${client.id}`} className="underline">
                      {client.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-2">{client.cui}</td>
                  <td className="px-4 py-2">{client.city}</td>
                  <td className="px-4 py-2">{client.paymentTermDays} zile</td>
                  <td className="px-4 py-2">
                    <Badge>{client.isActive ? "Activ" : "Inactiv"}</Badge>
                  </td>
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

- [ ] **Step 5: Pagina de client nou**

Write `app/dashboard/clienti/nou/page.tsx`:

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export default function ClientNouPage() {
  return (
    <div>
      <Link href="/dashboard/clienti" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la clienți
      </Link>
      <PageHeader title="Client nou" />
      <ClientForm action={createClientAction} submitLabel="Salvează clientul" />
    </div>
  );
}
```

- [ ] **Step 6: Pagina de detaliu/editare**

Write `app/dashboard/clienti/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getClientById } from "@/lib/data/clients";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientForm } from "../client-form";
import { updateClientAction, setClientActiveAction } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const client = await getClientById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!client) notFound();

  const boundUpdate = updateClientAction.bind(null, client.id);
  const boundToggle = setClientActiveAction.bind(null, client.id, !client.isActive);

  return (
    <div>
      <Link href="/dashboard/clienti" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la clienți
      </Link>

      <PageHeader
        title={client.name}
        description={
          <>
            CUI: {client.cui} · <Badge>{client.isActive ? "Activ" : "Inactiv"}</Badge>
          </>
        }
        actions={
          <form action={boundToggle}>
            <Button type="submit" variant={client.isActive ? "destructive" : "outline"}>
              {client.isActive ? "Dezactivează" : "Reactivează"}
            </Button>
          </form>
        }
      />

      <ClientForm action={boundUpdate} values={client} submitLabel="Salvează modificările" />
    </div>
  );
}
```

- [ ] **Step 7: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 8: Verifică manual în browser**

Run `npm run dev`, log in as a company admin. Confirm: "Clienți" appears in the sidebar; you can create a client; creating a second client with the same CUI shows the amber warning and a second submit succeeds; search by name and by CUI works; deactivating hides the client from the default list and "Arată și clienții inactivi" reveals it.

- [ ] **Step 9: Commit**

```bash
git add app/dashboard/clienti components/app-shell.tsx
git commit -m "feat: add client management screens"
```

---

## Task 4: Modele Order & OrderStop + migrare

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_order/migration.sql` (generated)
- Test: `tests/data/decimal.test.ts`

**Interfaces:**
- Produces: `Order`, `OrderStop` models; enums `OrderStatus`, `Currency`, `StopType`; types `OrderModel`, `OrderStopModel`. Consumed by Tasks 6-11.

- [ ] **Step 1: Adaugă enum-urile și modelele**

Modify `prisma/schema.prisma` — add at the end:

```prisma
enum OrderStatus {
  NEW
  CONFIRMED
  IN_PROGRESS
  DELIVERED
  DOCUMENTS_RECEIVED
  INVOICED
  CANCELLED
}

enum Currency {
  RON
  EUR
}

enum StopType {
  LOADING
  UNLOADING
}

model Order {
  id                  String      @id @default(cuid())
  companyId           String
  year                Int
  sequence            Int
  orderNumber         String
  clientId            String
  clientReference     String
  status              OrderStatus @default(NEW)
  cargoDescription    String
  cargoWeightKg       Decimal?    @db.Decimal(10, 3)
  cargoPackaging      String?
  salePrice           Decimal     @db.Decimal(12, 2)
  currency            Currency
  exchangeRate        Decimal     @db.Decimal(10, 4)
  exchangeRateDate    DateTime    @db.Date
  salePriceRon        Decimal     @db.Decimal(12, 2)
  estimatedCostRon    Decimal?    @db.Decimal(12, 2)
  paymentTermDays     Int
  documentsReceivedAt DateTime?
  notes               String?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  company Company     @relation(fields: [companyId], references: [id])
  client  Client      @relation(fields: [clientId], references: [id])
  stops   OrderStop[]

  @@unique([companyId, year, sequence])
  @@unique([companyId, orderNumber])
  @@index([companyId, status])
}

model OrderStop {
  id            String   @id @default(cuid())
  orderId       String
  sequence      Int
  type          StopType
  locationName  String?
  address       String
  city          String
  country       String   @default("România")
  scheduledDate DateTime @db.Date
  timeFrom      String?
  timeTo        String?
  contactName   String?
  contactPhone  String?
  notes         String?

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([orderId, sequence])
}
```

Add the back-relations. Inside `model Company`, next to `clients`:

```prisma
  orders      Order[]
```

Inside `model Client`, after the `company` relation line:

```prisma
  orders Order[]
```

- [ ] **Step 2: Rulează migrarea pe baza de dezvoltare**

Run: `npx prisma migrate dev --name add_order`
Expected: migration applies, `Order` and `OrderStop` tables created.

- [ ] **Step 3: Aplică migrarea pe baza de test**

Run (PowerShell):
```bash
$env:DATABASE_URL=(Get-Content .env.test | Select-String 'DATABASE_URL' | ForEach-Object { $_ -replace 'DATABASE_URL=','' -replace '"','' }); npx prisma migrate deploy
```

Run (bash):
```bash
DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d'"' -f2) npx prisma migrate deploy
```

Expected: `All migrations have been successfully applied.`

- [ ] **Step 4: Extinde curățarea bazei de test**

Orders reference clients, so they must be deleted first. Task 1 already added
the `client.deleteMany()` line; this adds the two order tables above it.

Modify `tests/helpers/db.ts` — replace the body of `resetDatabase`:

```ts
export async function resetDatabase() {
  await prisma.orderStop.deleteMany();
  await prisma.order.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
```

- [ ] **Step 5: Scrie testul care confirmă comportamentul Decimal**

Money correctness depends on `Decimal` round-tripping exactly. This test pins that behaviour before any pricing code relies on it.

Write `tests/data/decimal.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";

describe("stocarea sumelor ca Decimal", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("păstrează exact bănuții, fără erori de virgulă mobilă", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Client",
        cui: "RO2",
        address: "Str. 1",
        city: "Ploiești",
      },
    });

    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        year: 2026,
        sequence: 1,
        orderNumber: "2026-0001",
        clientId: client.id,
        clientReference: "REF-1",
        cargoDescription: "Paleți",
        salePrice: "1234.56",
        currency: "EUR",
        exchangeRate: "4.9772",
        exchangeRateDate: new Date("2026-08-17"),
        salePriceRon: "6144.72",
        paymentTermDays: 45,
      },
    });

    expect(order.salePrice.toString()).toBe("1234.56");
    expect(order.exchangeRate.toString()).toBe("4.9772");
    expect(order.salePriceRon.toString()).toBe("6144.72");
  });
});
```

- [ ] **Step 6: Regenerează, verifică tipurile, rulează testele**

Run: `npx prisma generate && npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/ tests/helpers/db.ts tests/data/decimal.test.ts
git commit -m "feat: add Order and OrderStop models"
```

---

## Task 5: Cursul valutar BNR

**Files:**
- Create: `lib/bnr.ts`
- Test: `tests/bnr.test.ts`

**Interfaces:**
- Produces:
  - `parseEurRate(xml: string): { rate: string; date: string }` — pure, no network
  - `getEurRate(): Promise<{ rate: string; date: string }>` — fetches and caches
  - `class ExchangeRateUnavailableError`
  - `BNR_RATES_URL` constant

- [ ] **Step 1: Scrie testele care eșuează**

Only the parser is tested — the network call is not, so the suite stays deterministic and offline-safe.

Write `tests/bnr.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEurRate, ExchangeRateUnavailableError } from "@/lib/bnr";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd">
  <Header><Publisher>National Bank of Romania</Publisher></Header>
  <Body>
    <Subject>Reference rates</Subject>
    <OrigCurrency>RON</OrigCurrency>
    <Cube date="2026-08-15">
      <Rate currency="AED">1.3550</Rate>
      <Rate currency="EUR">4.9772</Rate>
      <Rate currency="USD">4.2610</Rate>
    </Cube>
  </Body>
</DataSet>`;

describe("parseEurRate", () => {
  it("extrage cursul EUR și data publicării", () => {
    const result = parseEurRate(SAMPLE_XML);
    expect(result.rate).toBe("4.9772");
    expect(result.date).toBe("2026-08-15");
  });

  it("aruncă dacă lipsește cursul EUR", () => {
    const xml = SAMPLE_XML.replace('<Rate currency="EUR">4.9772</Rate>', "");
    expect(() => parseEurRate(xml)).toThrow(ExchangeRateUnavailableError);
  });

  it("aruncă dacă lipsește data", () => {
    const xml = SAMPLE_XML.replace('<Cube date="2026-08-15">', "<Cube>");
    expect(() => parseEurRate(xml)).toThrow(ExchangeRateUnavailableError);
  });

  it("aruncă pe conținut care nu e XML-ul BNR", () => {
    expect(() => parseEurRate("<html>eroare</html>")).toThrow(ExchangeRateUnavailableError);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/bnr.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/bnr.ts`:

```ts
// The feed lives on the curs.bnr.ro host; www.bnr.ro now 302-redirects to the
// homepage, so pointing this back at www silently breaks every EUR order.
export const BNR_RATES_URL = "https://curs.bnr.ro/nbrfxrates.xml";

export class ExchangeRateUnavailableError extends Error {
  constructor(message = "Cursul BNR nu este disponibil momentan.") {
    super(message);
    this.name = "ExchangeRateUnavailableError";
  }
}

/**
 * Pulls the EUR reference rate out of BNR's daily XML. The document is tiny and
 * has a fixed shape, so two targeted patterns beat pulling in an XML parser.
 */
export function parseEurRate(xml: string): { rate: string; date: string } {
  const dateMatch = xml.match(/<Cube\s+date="(\d{4}-\d{2}-\d{2})"/);
  if (!dateMatch) {
    throw new ExchangeRateUnavailableError("Răspunsul BNR nu conține data cursului.");
  }

  const rateMatch = xml.match(/<Rate\s+currency="EUR"\s*>([\d.]+)<\/Rate>/);
  if (!rateMatch) {
    throw new ExchangeRateUnavailableError("Răspunsul BNR nu conține cursul EUR.");
  }

  return { rate: rateMatch[1], date: dateMatch[1] };
}

let cached: { rate: string; date: string; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * BNR publishes only on business days; the document always carries the latest
 * published rate, so weekend orders correctly use Friday's rate and record
 * Friday's date.
 */
export async function getEurRate(): Promise<{ rate: string; date: string }> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { rate: cached.rate, date: cached.date };
  }

  let xml: string;
  try {
    const response = await fetch(BNR_RATES_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new ExchangeRateUnavailableError(`BNR a răspuns cu status ${response.status}.`);
    }
    xml = await response.text();
  } catch (error) {
    if (error instanceof ExchangeRateUnavailableError) throw error;
    throw new ExchangeRateUnavailableError();
  }

  const parsed = parseEurRate(xml);
  cached = { ...parsed, fetchedAt: Date.now() };
  return parsed;
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verifică o dată contra BNR-ului real**

The parser is tested against a fixture; this confirms the fixture matches reality.

Run: `npx tsx -e "import('./lib/bnr.ts').then(async m => console.log(await m.getEurRate()))"`
Expected: prints a plausible rate and date, e.g. `{ rate: '4.9772', date: '2026-08-15' }`. If it throws, the BNR document shape changed and `parseEurRate` needs updating.

- [ ] **Step 6: Commit**

```bash
git add lib/bnr.ts tests/bnr.test.ts
git commit -m "feat: add BNR exchange rate lookup"
```

---

## Task 6: Tranzițiile de stare

**Files:**
- Create: `lib/orderStatus.ts`
- Test: `tests/orderStatus.test.ts`

**Interfaces:**
- Consumes: `OrderStatus` from `@/lib/generated/prisma/enums`.
- Produces:
  - `ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]>`
  - `assertTransitionAllowed(from: OrderStatus, to: OrderStatus): void`
  - `class InvalidStatusTransitionError`
  - `ORDER_STATUS_LABELS: Record<OrderStatus, string>`
  - `STOP_TYPE_LABELS: Record<StopType, string>`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/orderStatus.test.ts`:

```ts
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
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/orderStatus.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/orderStatus.ts`:

```ts
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
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/orderStatus.ts tests/orderStatus.test.ts
git commit -m "feat: add order status transition rules"
```

---

## Task 7: Crearea comenzii — numerotare, valută, opriri

**Files:**
- Create: `lib/data/orders.ts`
- Test: `tests/data/orders.test.ts`

**Interfaces:**
- Consumes: `prisma`, `assertCompanyAccess`/`SessionUser`/`TenantAccessError`, `getEurRate`/`ExchangeRateUnavailableError` (Task 5), `Prisma` namespace.
- Produces:
  - `createOrder(session: SessionUser, input: CreateOrderInput): Promise<OrderWithStops>`
  - types `CreateOrderInput`, `CreateStopInput`, `OrderWithStops`
  - classes `InvalidOrderError`, `OrderNumberingError`
  - `formatOrderNumber(year: number, sequence: number): string`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/orders.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createOrder, InvalidOrderError, formatOrderNumber } from "@/lib/data/orders";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompanyWithClient(companyName: string, cui: string) {
  const company = await prisma.company.create({ data: { name: companyName, cui } });
  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      name: `Client ${companyName}`,
      cui: `${cui}-C`,
      address: "Str. 1",
      city: "Ploiești",
      paymentTermDays: 30,
    },
  });
  return { company, client, session: { role: "COMPANY_ADMIN" as const, companyId: company.id } };
}

const stops = [
  {
    type: "LOADING" as const,
    address: "Str. Depozit 1",
    city: "Ploiești",
    scheduledDate: new Date("2026-09-01"),
  },
  {
    type: "UNLOADING" as const,
    address: "Str. Fabricii 5",
    city: "Timișoara",
    scheduledDate: new Date("2026-09-02"),
  },
];

function orderInput(companyId: string, clientId: string, overrides = {}) {
  return {
    companyId,
    clientId,
    clientReference: "REF-100",
    cargoDescription: "Paleți cu marfă generală",
    salePrice: "1000.00",
    currency: "RON" as const,
    paymentTermDays: 30,
    stops,
    ...overrides,
  };
}

describe("formatOrderNumber", () => {
  it("compune numărul cu secvența pe patru cifre", () => {
    expect(formatOrderNumber(2026, 1)).toBe("2026-0001");
    expect(formatOrderNumber(2026, 42)).toBe("2026-0042");
    expect(formatOrderNumber(2026, 1234)).toBe("2026-1234");
  });
});

describe("createOrder", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează comanda cu status NEW și opririle în ordine", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const order = await createOrder(session, orderInput(company.id, client.id));

    expect(order.status).toBe("NEW");
    expect(order.orderNumber).toBe(`${new Date().getFullYear()}-0001`);
    expect(order.stops).toHaveLength(2);
    expect(order.stops[0].sequence).toBe(1);
    expect(order.stops[0].type).toBe("LOADING");
    expect(order.stops[1].sequence).toBe(2);
    expect(order.stops[1].type).toBe("UNLOADING");
  });

  it("numerotează secvențial în cadrul firmei", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const first = await createOrder(session, orderInput(company.id, client.id));
    const second = await createOrder(session, orderInput(company.id, client.id));

    expect(second.sequence).toBe(first.sequence + 1);
  });

  it("numerotează independent pentru fiecare firmă", async () => {
    const a = await makeCompanyWithClient("Firma A", "RO1");
    const b = await makeCompanyWithClient("Firma B", "RO2");

    await createOrder(a.session, orderInput(a.company.id, a.client.id));
    const orderB = await createOrder(b.session, orderInput(b.company.id, b.client.id));

    expect(orderB.sequence).toBe(1);
  });

  it("nu dă același număr la două comenzi create simultan", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const results = await Promise.all([
      createOrder(session, orderInput(company.id, client.id)),
      createOrder(session, orderInput(company.id, client.id)),
      createOrder(session, orderInput(company.id, client.id)),
    ]);

    const numbers = results.map((o) => o.orderNumber);
    expect(new Set(numbers).size).toBe(3);
  });

  it("pentru RON folosește cursul 1 și nu apelează BNR", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const order = await createOrder(session, orderInput(company.id, client.id));

    expect(order.exchangeRate.toString()).toBe("1");
    expect(order.salePriceRon.toString()).toBe("1000");
  });

  it("pentru EUR calculează echivalentul în RON cu cursul dat manual", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    const order = await createOrder(
      session,
      orderInput(company.id, client.id, {
        salePrice: "1000.00",
        currency: "EUR",
        manualExchangeRate: "4.9772",
        manualExchangeRateDate: new Date("2026-08-15"),
      })
    );

    expect(order.exchangeRate.toString()).toBe("4.9772");
    expect(order.salePriceRon.toString()).toBe("4977.2");
  });

  it("respinge o comandă fără încărcare", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    await expect(
      createOrder(
        session,
        orderInput(company.id, client.id, { stops: [stops[1]] })
      )
    ).rejects.toThrow(InvalidOrderError);
  });

  it("respinge o comandă fără descărcare", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");

    await expect(
      createOrder(
        session,
        orderInput(company.id, client.id, { stops: [stops[0]] })
      )
    ).rejects.toThrow(InvalidOrderError);
  });

  it("respinge crearea unei comenzi pentru altă firmă", async () => {
    const a = await makeCompanyWithClient("Firma A", "RO1");
    const b = await makeCompanyWithClient("Firma B", "RO2");

    await expect(
      createOrder(a.session, orderInput(b.company.id, b.client.id))
    ).rejects.toThrow(TenantAccessError);
  });

  it("respinge un client care aparține altei firme", async () => {
    const a = await makeCompanyWithClient("Firma A", "RO1");
    const b = await makeCompanyWithClient("Firma B", "RO2");

    await expect(
      createOrder(a.session, orderInput(a.company.id, b.client.id))
    ).rejects.toThrow(InvalidOrderError);
  });

  it("respinge un client dezactivat", async () => {
    const { company, client, session } = await makeCompanyWithClient("Firma A", "RO1");
    await prisma.client.update({ where: { id: client.id }, data: { isActive: false } });

    await expect(
      createOrder(session, orderInput(company.id, client.id))
    ).rejects.toThrow(InvalidOrderError);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/orders.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/data/orders.ts`:

```ts
import { Prisma } from "@/lib/generated/prisma/client";
import type { Currency, StopType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { getEurRate } from "@/lib/bnr";

export class InvalidOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderError";
  }
}

export class OrderNumberingError extends Error {
  constructor() {
    super("Nu s-a putut aloca un număr de comandă. Încearcă din nou.");
    this.name = "OrderNumberingError";
  }
}

export type CreateStopInput = {
  type: StopType;
  locationName?: string | null;
  address: string;
  city: string;
  country?: string;
  scheduledDate: Date;
  timeFrom?: string | null;
  timeTo?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
};

export type CreateOrderInput = {
  companyId: string;
  clientId: string;
  clientReference: string;
  cargoDescription: string;
  cargoWeightKg?: string | null;
  cargoPackaging?: string | null;
  salePrice: string;
  currency: Currency;
  estimatedCostRon?: string | null;
  paymentTermDays: number;
  notes?: string | null;
  stops: CreateStopInput[];
  /** Supplied by the UI when BNR is unreachable and the user typed the rate. */
  manualExchangeRate?: string;
  manualExchangeRateDate?: Date;
};

export type OrderWithStops = Prisma.OrderGetPayload<{ include: { stops: true } }>;

export function formatOrderNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}

function assertStopsValid(stops: CreateStopInput[]) {
  if (!stops.some((s) => s.type === "LOADING")) {
    throw new InvalidOrderError("Comanda trebuie să aibă cel puțin o încărcare.");
  }
  if (!stops.some((s) => s.type === "UNLOADING")) {
    throw new InvalidOrderError("Comanda trebuie să aibă cel puțin o descărcare.");
  }
}

async function resolveRate(input: CreateOrderInput): Promise<{ rate: string; date: Date }> {
  if (input.currency === "RON") {
    return { rate: "1", date: new Date() };
  }
  if (input.manualExchangeRate) {
    return {
      rate: input.manualExchangeRate,
      date: input.manualExchangeRateDate ?? new Date(),
    };
  }
  const { rate, date } = await getEurRate();
  return { rate, date: new Date(date) };
}

// Postgres serializes colliding unique-key inserts into rounds that eliminate
// one contender each, so N racing callers can need up to N attempts. A value of
// 2 cannot cover even 3-way contention — the concurrency test below fails on it.
const MAX_NUMBERING_ATTEMPTS = 8;

export async function createOrder(
  session: SessionUser,
  input: CreateOrderInput
): Promise<OrderWithStops> {
  assertCompanyAccess(session, input.companyId);
  assertStopsValid(input.stops);

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client || client.companyId !== input.companyId) {
    throw new InvalidOrderError("Clientul selectat nu aparține firmei tale.");
  }
  if (!client.isActive) {
    throw new InvalidOrderError("Clientul selectat este dezactivat.");
  }

  const { rate, date } = await resolveRate(input);
  const exchangeRate = new Prisma.Decimal(rate);
  const salePrice = new Prisma.Decimal(input.salePrice);
  const salePriceRon = salePrice.mul(exchangeRate).toDecimalPlaces(2);
  const year = new Date().getFullYear();

  // The unique constraint on (companyId, year, sequence) is the real guard against
  // two concurrent creates claiming one number; a lost race retries once.
  for (let attempt = 0; attempt < MAX_NUMBERING_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const highest = await tx.order.aggregate({
          where: { companyId: input.companyId, year },
          _max: { sequence: true },
        });
        const sequence = (highest._max.sequence ?? 0) + 1;

        return tx.order.create({
          data: {
            companyId: input.companyId,
            year,
            sequence,
            orderNumber: formatOrderNumber(year, sequence),
            clientId: input.clientId,
            clientReference: input.clientReference,
            cargoDescription: input.cargoDescription,
            cargoWeightKg: input.cargoWeightKg ?? null,
            cargoPackaging: input.cargoPackaging ?? null,
            salePrice,
            currency: input.currency,
            exchangeRate,
            exchangeRateDate: date,
            salePriceRon,
            estimatedCostRon: input.estimatedCostRon ?? null,
            paymentTermDays: input.paymentTermDays,
            notes: input.notes ?? null,
            stops: {
              create: input.stops.map((stop, index) => ({
                sequence: index + 1,
                type: stop.type,
                locationName: stop.locationName ?? null,
                address: stop.address,
                city: stop.city,
                country: stop.country ?? "România",
                scheduledDate: stop.scheduledDate,
                timeFrom: stop.timeFrom ?? null,
                timeTo: stop.timeTo ?? null,
                contactName: stop.contactName ?? null,
                contactPhone: stop.contactPhone ?? null,
                notes: stop.notes ?? null,
              })),
            },
          },
          include: { stops: { orderBy: { sequence: "asc" } } },
        });
      });
    } catch (error) {
      const isNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (isNumberCollision && attempt < MAX_NUMBERING_ATTEMPTS - 1) {
        continue;
      }
      if (isNumberCollision) throw new OrderNumberingError();
      throw error;
    }
  }

  throw new OrderNumberingError();
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/orders.ts tests/data/orders.test.ts
git commit -m "feat: add order creation with numbering, currency and stops"
```

---

## Task 8: Citirea și actualizarea comenzilor

**Files:**
- Modify: `lib/data/orders.ts`
- Test: `tests/data/ordersUpdate.test.ts`

**Interfaces:**
- Consumes: everything from Task 7, plus `assertTransitionAllowed` (Task 6).
- Produces (appended to `lib/data/orders.ts`):
  - `listOrders(session, companyId, options?: { status?: OrderStatus; search?: string }): Promise<OrderListItem[]>`
  - `getOrderById(session, orderId): Promise<OrderWithStopsAndClient | null>`
  - `updateOrderStatus(session, orderId, to: OrderStatus): Promise<OrderModel>`
  - `updateOrderDetails(session, orderId, input: UpdateOrderInput): Promise<OrderModel>`
  - types `OrderListItem`, `OrderWithStopsAndClient`, `UpdateOrderInput`
  - `calculateMargin(order): { marginRon: string; marginPercent: string } | null`

- [ ] **Step 1: Scrie testele care eșuează**

Write `tests/data/ordersUpdate.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  createOrder,
  listOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderDetails,
  calculateMargin,
} from "@/lib/data/orders";
import { InvalidStatusTransitionError } from "@/lib/orderStatus";
import { TenantAccessError } from "@/lib/tenancy";

async function setup(companyName: string, cui: string) {
  const company = await prisma.company.create({ data: { name: companyName, cui } });
  const client = await prisma.client.create({
    data: {
      companyId: company.id,
      name: `Client ${companyName}`,
      cui: `${cui}-C`,
      address: "Str. 1",
      city: "Ploiești",
    },
  });
  const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
  const order = await createOrder(session, {
    companyId: company.id,
    clientId: client.id,
    clientReference: "REF-1",
    cargoDescription: "Paleți",
    salePrice: "1000.00",
    currency: "RON",
    estimatedCostRon: "600.00",
    paymentTermDays: 45,
    stops: [
      { type: "LOADING", address: "A", city: "Ploiești", scheduledDate: new Date("2026-09-01") },
      { type: "UNLOADING", address: "B", city: "Arad", scheduledDate: new Date("2026-09-02") },
    ],
  });
  return { company, client, session, order };
}

describe("listOrders", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar comenzile firmei cerute", async () => {
    const a = await setup("Firma A", "RO1");
    await setup("Firma B", "RO2");

    const result = await listOrders(a.session, a.company.id);

    expect(result).toHaveLength(1);
    expect(result[0].orderNumber).toBe(a.order.orderNumber);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(listOrders(a.session, b.company.id)).rejects.toThrow(TenantAccessError);
  });

  it("filtrează după stare", async () => {
    const a = await setup("Firma A", "RO1");

    expect(await listOrders(a.session, a.company.id, { status: "NEW" })).toHaveLength(1);
    expect(await listOrders(a.session, a.company.id, { status: "INVOICED" })).toHaveLength(0);
  });

  it("filtrează după client", async () => {
    const a = await setup("Firma A", "RO1");
    const otherClient = await prisma.client.create({
      data: {
        companyId: a.company.id,
        name: "Alt client",
        cui: "RO-ALT",
        address: "Str. 2",
        city: "Cluj",
      },
    });

    expect(
      await listOrders(a.session, a.company.id, { clientId: a.client.id })
    ).toHaveLength(1);
    expect(
      await listOrders(a.session, a.company.id, { clientId: otherClient.id })
    ).toHaveLength(0);
  });

  it("caută după numărul comenzii și după referința clientului", async () => {
    const a = await setup("Firma A", "RO1");

    expect(await listOrders(a.session, a.company.id, { search: a.order.orderNumber })).toHaveLength(1);
    expect(await listOrders(a.session, a.company.id, { search: "REF-1" })).toHaveLength(1);
    expect(await listOrders(a.session, a.company.id, { search: "inexistent" })).toHaveLength(0);
  });
});

describe("getOrderById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru o comandă din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    expect(await getOrderById(a.session, b.order.id)).toBeNull();
  });

  it("include opririle în ordine și clientul", async () => {
    const a = await setup("Firma A", "RO1");

    const order = await getOrderById(a.session, a.order.id);

    expect(order!.stops.map((s) => s.sequence)).toEqual([1, 2]);
    expect(order!.client.name).toBe("Client Firma A");
  });
});

describe("updateOrderStatus", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("avansează starea când tranziția e permisă", async () => {
    const a = await setup("Firma A", "RO1");

    const updated = await updateOrderStatus(a.session, a.order.id, "CONFIRMED");

    expect(updated.status).toBe("CONFIRMED");
  });

  it("respinge o tranziție nepermisă", async () => {
    const a = await setup("Firma A", "RO1");

    await expect(updateOrderStatus(a.session, a.order.id, "INVOICED")).rejects.toThrow(
      InvalidStatusTransitionError
    );
  });

  it("completează automat data documentelor la trecerea în DOCUMENTS_RECEIVED", async () => {
    const a = await setup("Firma A", "RO1");
    await updateOrderStatus(a.session, a.order.id, "CONFIRMED");
    await updateOrderStatus(a.session, a.order.id, "IN_PROGRESS");
    await updateOrderStatus(a.session, a.order.id, "DELIVERED");

    const updated = await updateOrderStatus(a.session, a.order.id, "DOCUMENTS_RECEIVED");

    expect(updated.documentsReceivedAt).toBeInstanceOf(Date);
  });

  it("respinge schimbarea stării unei comenzi din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(updateOrderStatus(a.session, b.order.id, "CONFIRMED")).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("updateOrderDetails", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("recalculează echivalentul în RON cu cursul stocat, nu cu unul nou", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const client = await prisma.client.create({
      data: { companyId: company.id, name: "C", cui: "RO2", address: "A", city: "B" },
    });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const order = await createOrder(session, {
      companyId: company.id,
      clientId: client.id,
      clientReference: "REF",
      cargoDescription: "Marfă",
      salePrice: "1000.00",
      currency: "EUR",
      manualExchangeRate: "5.0000",
      manualExchangeRateDate: new Date("2026-08-15"),
      paymentTermDays: 45,
      stops: [
        { type: "LOADING", address: "A", city: "X", scheduledDate: new Date("2026-09-01") },
        { type: "UNLOADING", address: "B", city: "Y", scheduledDate: new Date("2026-09-02") },
      ],
    });

    const updated = await updateOrderDetails(session, order.id, { salePrice: "2000.00" });

    expect(updated.exchangeRate.toString()).toBe("5");
    expect(updated.salePriceRon.toString()).toBe("10000");
  });

  it("respinge modificarea unei comenzi din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(
      updateOrderDetails(a.session, b.order.id, { clientReference: "FURAT" })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("calculateMargin", () => {
  it("calculează marja și procentul", () => {
    const result = calculateMargin({ salePriceRon: "1000.00", estimatedCostRon: "600.00" });
    expect(result!.marginRon).toBe("400");
    expect(result!.marginPercent).toBe("40");
  });

  it("returnează null când costul lipsește", () => {
    expect(calculateMargin({ salePriceRon: "1000.00", estimatedCostRon: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — funcțiile nu există în `lib/data/orders.ts`.

- [ ] **Step 3: Implementează — adaugă la finalul `lib/data/orders.ts`**

Append to `lib/data/orders.ts`:

```ts
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { assertTransitionAllowed } from "@/lib/orderStatus";

export type OrderListItem = Prisma.OrderGetPayload<{
  include: { client: { select: { name: true } } };
}>;

export type OrderWithStopsAndClient = Prisma.OrderGetPayload<{
  include: { stops: true; client: true };
}>;

export type UpdateOrderInput = {
  clientReference?: string;
  cargoDescription?: string;
  cargoWeightKg?: string | null;
  cargoPackaging?: string | null;
  salePrice?: string;
  estimatedCostRon?: string | null;
  paymentTermDays?: number;
  notes?: string | null;
};

export async function listOrders(
  session: SessionUser,
  companyId: string,
  options: { status?: OrderStatus; search?: string; clientId?: string } = {}
): Promise<OrderListItem[]> {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.order.findMany({
    where: {
      companyId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { clientReference: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { client: { select: { name: true } } },
    orderBy: [{ year: "desc" }, { sequence: "desc" }],
  });
}

export async function getOrderById(
  session: SessionUser,
  orderId: string
): Promise<OrderWithStopsAndClient | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { stops: { orderBy: { sequence: "asc" } }, client: true },
  });
  if (!order) return null;
  // Null rather than throw, so pages render 404 without revealing existence.
  if (session.role !== "SUPER_ADMIN" && order.companyId !== session.companyId) {
    return null;
  }
  return order;
}

async function assertOwnOrder(session: SessionUser, orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assertCompanyAccess(session, order.companyId);
  return order;
}

export async function updateOrderStatus(
  session: SessionUser,
  orderId: string,
  to: OrderStatus
) {
  const order = await assertOwnOrder(session, orderId);
  assertTransitionAllowed(order.status, to);

  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: to,
      ...(to === "DOCUMENTS_RECEIVED" && !order.documentsReceivedAt
        ? { documentsReceivedAt: new Date() }
        : {}),
    },
  });
}

export async function updateOrderDetails(
  session: SessionUser,
  orderId: string,
  input: UpdateOrderInput
) {
  const order = await assertOwnOrder(session, orderId);

  // The rate is frozen at creation: a later price edit is converted with the
  // stored rate, never a fresh one.
  const salePriceRon =
    input.salePrice !== undefined
      ? new Prisma.Decimal(input.salePrice).mul(order.exchangeRate).toDecimalPlaces(2)
      : undefined;

  return prisma.order.update({
    where: { id: orderId },
    data: {
      ...input,
      ...(salePriceRon ? { salePriceRon } : {}),
    },
  });
}

export function calculateMargin(order: {
  salePriceRon: Prisma.Decimal | string;
  estimatedCostRon: Prisma.Decimal | string | null;
}): { marginRon: string; marginPercent: string } | null {
  if (order.estimatedCostRon === null) return null;

  const sale = new Prisma.Decimal(order.salePriceRon);
  const cost = new Prisma.Decimal(order.estimatedCostRon);
  const margin = sale.minus(cost);
  const percent = sale.isZero()
    ? new Prisma.Decimal(0)
    : margin.div(sale).mul(100).toDecimalPlaces(1);

  return { marginRon: margin.toString(), marginPercent: percent.toString() };
}
```

**Note:** move the two new `import` lines to the top of the file, joining the existing imports — TypeScript requires imports at module top level.

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/orders.ts tests/data/ordersUpdate.test.ts
git commit -m "feat: add order reading, status changes and margin"
```

---

## Task 9: Lista de comenzi

**Files:**
- Create: `app/dashboard/comenzi/page.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `listOrders`, `calculateMargin` (Task 8); `ORDER_STATUS_LABELS` (Task 6).

- [ ] **Step 1: Adaugă intrarea în meniu**

Modify `components/app-shell.tsx` — replace `COMPANY_NAV`:

```ts
const COMPANY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/comenzi", label: "Comenzi" },
  { href: "/dashboard/clienti", label: "Clienți" },
  { href: "/dashboard/echipa", label: "Echipă", roles: ["COMPANY_ADMIN"] },
];
```

- [ ] **Step 2: Pagina**

Write `app/dashboard/comenzi/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { listOrders } from "@/lib/data/orders";
import { ORDER_STATUS_LABELS } from "@/lib/orderStatus";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_VALUES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export default async function ComenziPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stare?: string }>;
}) {
  const { q, stare } = await searchParams;
  const session = await auth();

  const status = STATUS_VALUES.includes(stare as OrderStatus)
    ? (stare as OrderStatus)
    : undefined;

  const orders = await listOrders(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { search: q, status }
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Comenzi"
        description="Comenzile de transport primite de la clienți."
        actions={
          <Link href="/dashboard/comenzi/noua" className={buttonVariants()}>
            Comandă nouă
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          name="q"
          placeholder="Caută după număr sau referința clientului"
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <select
          name="stare"
          defaultValue={stare ?? ""}
          className="rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">Toate stările</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
      </form>

      {orders.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Nicio comandă găsită.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Număr</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Referință</th>
                <th className="px-4 py-2 font-medium">Preț</th>
                <th className="px-4 py-2 font-medium">Stare</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/comenzi/${order.id}`} className="underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{order.client.name}</td>
                  <td className="text-muted-foreground px-4 py-2">{order.clientReference}</td>
                  <td className="px-4 py-2">
                    {order.salePrice.toString()} {order.currency}
                  </td>
                  <td className="px-4 py-2">
                    <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
                  </td>
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

- [ ] **Step 3: Verifică tipurile**

Run: `npx tsc --noEmit`
Expected: silent.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/comenzi components/app-shell.tsx
git commit -m "feat: add order list page"
```

---

## Task 10: Formularul de comandă nouă

**Files:**
- Create: `app/dashboard/comenzi/actions.ts`, `app/dashboard/comenzi/noua/page.tsx`, `app/dashboard/comenzi/noua/order-form.tsx`

**Interfaces:**
- Consumes: `createOrder`, `InvalidOrderError`, `OrderNumberingError` (Task 7); `listClients` (Task 2); `ExchangeRateUnavailableError`, `getEurRate` (Task 5); `STOP_TYPE_LABELS` (Task 6).
- Produces: `createOrderAction`, `OrderFormState`.

- [ ] **Step 1: Server action**

Write `app/dashboard/comenzi/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createOrder,
  updateOrderStatus,
  updateOrderDetails,
  InvalidOrderError,
  OrderNumberingError,
  type CreateStopInput,
} from "@/lib/data/orders";
import { ExchangeRateUnavailableError } from "@/lib/bnr";
import { InvalidStatusTransitionError } from "@/lib/orderStatus";
import type { Currency, OrderStatus } from "@/lib/generated/prisma/enums";

export type OrderFormState = {
  error: string | null;
  /** Set when BNR is unreachable, so the form can ask for a manual rate. */
  needsManualRate: boolean;
};

type StopPayload = {
  type: "LOADING" | "UNLOADING";
  locationName?: string;
  address: string;
  city: string;
  country?: string;
  scheduledDate: string;
  timeFrom?: string;
  timeTo?: string;
  contactName?: string;
  contactPhone?: string;
};

export async function createOrderAction(
  _prevState: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const rawStops = formData.get("stops") as string;
  let stops: CreateStopInput[];
  try {
    stops = (JSON.parse(rawStops) as StopPayload[]).map((stop) => ({
      type: stop.type,
      locationName: stop.locationName || null,
      address: stop.address,
      city: stop.city,
      country: stop.country || "România",
      scheduledDate: new Date(stop.scheduledDate),
      timeFrom: stop.timeFrom || null,
      timeTo: stop.timeTo || null,
      contactName: stop.contactName || null,
      contactPhone: stop.contactPhone || null,
    }));
  } catch {
    return { error: "Opririle nu au putut fi citite. Reîncarcă pagina.", needsManualRate: false };
  }

  const manualRate = (formData.get("manualExchangeRate") as string) || undefined;

  try {
    await createOrder(
      { role: session.user.role, companyId: session.user.companyId },
      {
        companyId: session.user.companyId,
        clientId: formData.get("clientId") as string,
        clientReference: formData.get("clientReference") as string,
        cargoDescription: formData.get("cargoDescription") as string,
        cargoWeightKg: (formData.get("cargoWeightKg") as string) || null,
        cargoPackaging: (formData.get("cargoPackaging") as string) || null,
        salePrice: formData.get("salePrice") as string,
        currency: formData.get("currency") as Currency,
        estimatedCostRon: (formData.get("estimatedCostRon") as string) || null,
        paymentTermDays: Number(formData.get("paymentTermDays") || 45),
        notes: (formData.get("notes") as string) || null,
        stops,
        manualExchangeRate: manualRate,
      }
    );
  } catch (error) {
    if (error instanceof ExchangeRateUnavailableError) {
      return {
        error: `${error.message} Introdu manual cursul EUR → RON și trimite din nou.`,
        needsManualRate: true,
      };
    }
    if (error instanceof InvalidOrderError || error instanceof OrderNumberingError) {
      return { error: error.message, needsManualRate: false };
    }
    throw error;
  }

  revalidatePath("/dashboard/comenzi");
  redirect("/dashboard/comenzi");
}

export async function updateOrderStatusAction(orderId: string, to: OrderStatus) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateOrderStatus(
      { role: session.user.role, companyId: session.user.companyId },
      orderId,
      to
    );
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      // Buttons only offer allowed transitions, so this means a stale page.
      revalidatePath(`/dashboard/comenzi/${orderId}`);
      return;
    }
    throw error;
  }

  revalidatePath(`/dashboard/comenzi/${orderId}`);
  revalidatePath("/dashboard/comenzi");
}

export async function updateOrderDetailsAction(
  orderId: string,
  _prevState: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  await updateOrderDetails(
    { role: session.user.role, companyId: session.user.companyId },
    orderId,
    {
      clientReference: formData.get("clientReference") as string,
      cargoDescription: formData.get("cargoDescription") as string,
      cargoWeightKg: (formData.get("cargoWeightKg") as string) || null,
      cargoPackaging: (formData.get("cargoPackaging") as string) || null,
      salePrice: formData.get("salePrice") as string,
      estimatedCostRon: (formData.get("estimatedCostRon") as string) || null,
      paymentTermDays: Number(formData.get("paymentTermDays") || 45),
      notes: (formData.get("notes") as string) || null,
    }
  );

  revalidatePath(`/dashboard/comenzi/${orderId}`);
  return { error: null, needsManualRate: false };
}
```

- [ ] **Step 2: Componenta de formular cu opriri dinamice**

Write `app/dashboard/comenzi/noua/order-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrderAction, type OrderFormState } from "../actions";

type Stop = {
  type: "LOADING" | "UNLOADING";
  address: string;
  city: string;
  scheduledDate: string;
  timeFrom: string;
  timeTo: string;
  contactName: string;
  contactPhone: string;
};

function emptyStop(type: Stop["type"]): Stop {
  return {
    type,
    address: "",
    city: "",
    scheduledDate: "",
    timeFrom: "",
    timeTo: "",
    contactName: "",
    contactPhone: "",
  };
}

export function OrderForm({
  clients,
}: {
  clients: { id: string; name: string; paymentTermDays: number }[];
}) {
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(
    createOrderAction,
    { error: null, needsManualRate: false }
  );

  const [stops, setStops] = useState<Stop[]>([emptyStop("LOADING"), emptyStop("UNLOADING")]);
  const [paymentTermDays, setPaymentTermDays] = useState(clients[0]?.paymentTermDays ?? 45);
  const [currency, setCurrency] = useState("RON");

  function updateStop(index: number, patch: Partial<Stop>) {
    setStops((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      {/* Stops live in React state; this hidden field is how they reach the server. */}
      <input type="hidden" name="stops" value={JSON.stringify(stops)} />

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Client și marfă</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client</Label>
            <select
              id="clientId"
              name="clientId"
              required
              className="w-full rounded-lg border px-2 py-2 text-sm"
              onChange={(e) => {
                const client = clients.find((c) => c.id === e.target.value);
                if (client) setPaymentTermDays(client.paymentTermDays);
              }}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientReference">Referința clientului</Label>
            <Input id="clientReference" name="clientReference" required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cargoDescription">Descrierea mărfii</Label>
            <Input id="cargoDescription" name="cargoDescription" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargoWeightKg">Greutate (kg)</Label>
            <Input id="cargoWeightKg" name="cargoWeightKg" type="number" step="0.001" min="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargoPackaging">Ambalaj</Label>
            <Input id="cargoPackaging" name="cargoPackaging" placeholder="paleți, vrac..." />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Opriri</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStops((c) => [...c, emptyStop("LOADING")])}
            >
              + Încărcare
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStops((c) => [...c, emptyStop("UNLOADING")])}
            >
              + Descărcare
            </Button>
          </div>
        </div>

        {stops.map((stop, index) => (
          <div key={index} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {index + 1}. {stop.type === "LOADING" ? "Încărcare" : "Descărcare"}
              </span>
              {stops.length > 2 && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setStops((c) => c.filter((_, i) => i !== index))}
                >
                  Șterge
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Adresă"
                required
                value={stop.address}
                onChange={(e) => updateStop(index, { address: e.target.value })}
              />
              <Input
                placeholder="Oraș"
                required
                value={stop.city}
                onChange={(e) => updateStop(index, { city: e.target.value })}
              />
              <Input
                type="date"
                required
                value={stop.scheduledDate}
                onChange={(e) => updateStop(index, { scheduledDate: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={stop.timeFrom}
                  onChange={(e) => updateStop(index, { timeFrom: e.target.value })}
                />
                <Input
                  type="time"
                  value={stop.timeTo}
                  onChange={(e) => updateStop(index, { timeTo: e.target.value })}
                />
              </div>
              <Input
                placeholder="Persoană de contact"
                value={stop.contactName}
                onChange={(e) => updateStop(index, { contactName: e.target.value })}
              />
              <Input
                placeholder="Telefon"
                value={stop.contactPhone}
                onChange={(e) => updateStop(index, { contactPhone: e.target.value })}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Bani</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salePrice">Preț de vânzare</Label>
            <Input id="salePrice" name="salePrice" type="number" step="0.01" min="0" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Valută</Label>
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border px-2 py-2 text-sm"
            >
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimatedCostRon">Cost estimat (RON)</Label>
            <Input id="estimatedCostRon" name="estimatedCostRon" type="number" step="0.01" min="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paymentTermDays">Termen de plată (zile)</Label>
            <Input
              id="paymentTermDays"
              name="paymentTermDays"
              type="number"
              min={0}
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(Number(e.target.value))}
            />
          </div>
          {state.needsManualRate && currency === "EUR" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="manualExchangeRate">Curs EUR → RON (manual)</Label>
              <Input
                id="manualExchangeRate"
                name="manualExchangeRate"
                type="number"
                step="0.0001"
                min="0"
                required
              />
            </div>
          )}
        </div>
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observații</Label>
        <Input id="notes" name="notes" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : "Salvează comanda"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Pagina**

Write `app/dashboard/comenzi/noua/page.tsx`:

```tsx
import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { OrderForm } from "./order-form";

export default async function ComandaNouaPage() {
  const session = await auth();
  const clients = await listClients(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  return (
    <div>
      <Link href="/dashboard/comenzi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la comenzi
      </Link>
      <PageHeader title="Comandă nouă" />

      {clients.length === 0 ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Nu ai niciun client activ. O comandă are nevoie de un client.
          </p>
          <Link href="/dashboard/clienti/nou" className={buttonVariants()}>
            Adaugă primul client
          </Link>
        </div>
      ) : (
        <OrderForm
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            paymentTermDays: c.paymentTermDays,
          }))}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verifică tipurile**

Run: `npx tsc --noEmit`
Expected: silent.

- [ ] **Step 5: Verifică manual**

Run `npm run dev`. Create an order with three stops (one loading, two unloading) in RON. Confirm it appears in the list with number `<an>-0001`. Try saving with only a loading stop — confirm the Romanian validation error appears.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/comenzi
git commit -m "feat: add new order form with dynamic stops"
```

---

## Task 11: Fișa comenzii

**Files:**
- Create: `app/dashboard/comenzi/[id]/page.tsx`, `app/dashboard/comenzi/[id]/status-actions.tsx`

**Interfaces:**
- Consumes: `getOrderById`, `calculateMargin` (Task 8); `updateOrderStatusAction` (Task 10); `ALLOWED_TRANSITIONS`, `ORDER_STATUS_LABELS`, `STOP_TYPE_LABELS` (Task 6).

- [ ] **Step 1: Butoanele de schimbare a stării**

Write `app/dashboard/comenzi/[id]/status-actions.tsx`:

```tsx
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
```

- [ ] **Step 2: Pagina**

Write `app/dashboard/comenzi/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getOrderById, calculateMargin } from "@/lib/data/orders";
import { ORDER_STATUS_LABELS, STOP_TYPE_LABELS } from "@/lib/orderStatus";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { StatusActions } from "./status-actions";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(value);
}

export default async function ComandaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const order = await getOrderById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!order) notFound();

  const margin = calculateMargin(order);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/comenzi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la comenzi
      </Link>

      <PageHeader
        title={`Comanda ${order.orderNumber}`}
        description={
          <>
            {order.client.name} · Referință: {order.clientReference} ·{" "}
            <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
          </>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Stare</h2>
        <StatusActions orderId={order.id} status={order.status} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Bani</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Preț</dt>
            <dd>
              {order.salePrice.toString()} {order.currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Echivalent RON</dt>
            <dd>{order.salePriceRon.toString()} RON</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cost estimat</dt>
            <dd>{order.estimatedCostRon ? `${order.estimatedCostRon.toString()} RON` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Marjă</dt>
            <dd>{margin ? `${margin.marginRon} RON (${margin.marginPercent}%)` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Curs folosit</dt>
            <dd>
              {order.exchangeRate.toString()} din {formatDate(order.exchangeRateDate)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Termen de plată</dt>
            <dd>{order.paymentTermDays} zile</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Documente primite</dt>
            <dd>{order.documentsReceivedAt ? formatDate(order.documentsReceivedAt) : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Marfă</h2>
        <p className="text-sm">
          {order.cargoDescription}
          {order.cargoWeightKg && ` · ${order.cargoWeightKg.toString()} kg`}
          {order.cargoPackaging && ` · ${order.cargoPackaging}`}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Traseu</h2>
        <ol className="space-y-3">
          {order.stops.map((stop) => (
            <li key={stop.id} className="rounded-lg border p-4 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium">{stop.sequence}.</span>
                <Badge>{STOP_TYPE_LABELS[stop.type]}</Badge>
                <span className="text-muted-foreground">{formatDate(stop.scheduledDate)}</span>
                {stop.timeFrom && (
                  <span className="text-muted-foreground">
                    {stop.timeFrom}
                    {stop.timeTo && `–${stop.timeTo}`}
                  </span>
                )}
              </div>
              <p>
                {stop.address}, {stop.city}, {stop.country}
              </p>
              {stop.contactName && (
                <p className="text-muted-foreground">
                  Contact: {stop.contactName}
                  {stop.contactPhone && ` · ${stop.contactPhone}`}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

    </div>
  );
}
```

Note: `order.notes` is intentionally not rendered here. Task 12 adds the edit
form, which both shows and edits that field — rendering it twice would let the
two copies drift apart.

- [ ] **Step 3: Arată comenzile clientului pe fișa lui**

The spec requires the client page to show that client's orders. It could not be
built in Task 3 because orders did not exist yet.

Modify `app/dashboard/clienti/[id]/page.tsx` — add these imports next to the existing ones:

```tsx
import { listOrders } from "@/lib/data/orders";
import { ORDER_STATUS_LABELS } from "@/lib/orderStatus";
```

Then, after the `if (!client) notFound();` line, add:

```tsx
  const orders = await listOrders(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!,
    { clientId: client.id }
  );
```

And append this section immediately before the closing `</div>` of the page:

```tsx
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium">Comenzile acestui client</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nicio comandă încă.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-4 py-2 font-medium">Număr</th>
                  <th className="px-4 py-2 font-medium">Referință</th>
                  <th className="px-4 py-2 font-medium">Preț</th>
                  <th className="px-4 py-2 font-medium">Stare</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/dashboard/comenzi/${order.id}`} className="underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-2">{order.clientReference}</td>
                    <td className="px-4 py-2">
                      {order.salePrice.toString()} {order.currency}
                    </td>
                    <td className="px-4 py-2">
                      <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
```

- [ ] **Step 4: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 5: Verifică manual**

Open an order. Confirm: the route shows stops in order with Romanian type labels; margin shows as `400 RON (40%)` when a cost was entered and `—` when not; advancing to "Documente primite" fills in the date; once "Facturată", no further buttons appear. Then open the client's page and confirm the order appears in "Comenzile acestui client".

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/comenzi app/dashboard/clienti
git commit -m "feat: add order detail page and client order history"
```

---

## Task 12: Editarea comenzii

**Files:**
- Create: `app/dashboard/comenzi/[id]/edit-form.tsx`
- Modify: `app/dashboard/comenzi/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateOrderDetailsAction`, `OrderFormState` (Task 10); `OrderWithStopsAndClient` (Task 8).

The spec requires the order page to be editable. `updateOrderDetailsAction` was
written in Task 10 and has no caller until this task.

- [ ] **Step 1: Formularul de editare**

Write `app/dashboard/comenzi/[id]/edit-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrderDetailsAction, type OrderFormState } from "../actions";

export function OrderEditForm({
  orderId,
  values,
}: {
  orderId: string;
  values: {
    clientReference: string;
    cargoDescription: string;
    cargoWeightKg: string | null;
    cargoPackaging: string | null;
    salePrice: string;
    currency: string;
    estimatedCostRon: string | null;
    paymentTermDays: number;
    notes: string | null;
  };
}) {
  const boundAction = updateOrderDetailsAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(boundAction, {
    error: null,
    needsManualRate: false,
  });

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="clientReference">Referința clientului</Label>
        <Input id="clientReference" name="clientReference" defaultValue={values.clientReference} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paymentTermDays">Termen de plată (zile)</Label>
        <Input
          id="paymentTermDays"
          name="paymentTermDays"
          type="number"
          min={0}
          defaultValue={values.paymentTermDays}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cargoDescription">Descrierea mărfii</Label>
        <Input id="cargoDescription" name="cargoDescription" defaultValue={values.cargoDescription} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cargoWeightKg">Greutate (kg)</Label>
        <Input
          id="cargoWeightKg"
          name="cargoWeightKg"
          type="number"
          step="0.001"
          min="0"
          defaultValue={values.cargoWeightKg ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cargoPackaging">Ambalaj</Label>
        <Input id="cargoPackaging" name="cargoPackaging" defaultValue={values.cargoPackaging ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="salePrice">Preț de vânzare ({values.currency})</Label>
        <Input
          id="salePrice"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.salePrice}
          required
        />
        {/* The stored rate is reused on save; the currency itself is not editable. */}
        <p className="text-muted-foreground text-xs">
          Echivalentul în RON se recalculează cu cursul înghețat la crearea comenzii.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estimatedCostRon">Cost estimat (RON)</Label>
        <Input
          id="estimatedCostRon"
          name="estimatedCostRon"
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.estimatedCostRon ?? ""}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Observații</Label>
        <Input id="notes" name="notes" defaultValue={values.notes ?? ""} />
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : "Salvează modificările"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Adaugă formularul pe fișa comenzii**

Modify `app/dashboard/comenzi/[id]/page.tsx` — add the import:

```tsx
import { OrderEditForm } from "./edit-form";
```

And append this section immediately before the closing `</div>` of the page:

```tsx
      <section className="mt-10 border-t pt-8">
        <h2 className="mb-3 text-sm font-medium">Modifică datele comenzii</h2>
        <OrderEditForm
          orderId={order.id}
          values={{
            clientReference: order.clientReference,
            cargoDescription: order.cargoDescription,
            cargoWeightKg: order.cargoWeightKg?.toString() ?? null,
            cargoPackaging: order.cargoPackaging,
            salePrice: order.salePrice.toString(),
            currency: order.currency,
            estimatedCostRon: order.estimatedCostRon?.toString() ?? null,
            paymentTermDays: order.paymentTermDays,
            notes: order.notes,
          }}
        />
      </section>
```

- [ ] **Step 3: Verifică tipurile și testele**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` silent, all tests PASS.

- [ ] **Step 4: Verifică manual**

Open an EUR order, change the price, save. Confirm the RON equivalent changes but
the displayed exchange rate and its date stay exactly as they were.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/comenzi
git commit -m "feat: add order editing"
```

---

## Task 13: Checklist final de testare manuală

No new code — end-to-end verification of the whole module, run locally or on production.

- [ ] Creează un client nou; confirmă că apare în listă
- [ ] Creează un al doilea client cu **același CUI**; confirmă avertismentul galben și că al doilea click îl salvează
- [ ] Caută un client după nume, apoi după CUI; confirmă ambele
- [ ] Dezactivează un client; confirmă că dispare din listă și că „Arată și clienții inactivi" îl aduce înapoi
- [ ] Deschide „Comandă nouă"; confirmă că termenul de plată se completează automat de la client
- [ ] Creează o comandă în RON cu 3 opriri (1 încărcare, 2 descărcări); confirmă numărul `<an>-0001`
- [ ] Creează a doua comandă; confirmă numărul `<an>-0002`
- [ ] Creează o comandă în EUR; confirmă că echivalentul în RON și cursul apar pe fișă
- [ ] Încearcă o comandă doar cu încărcare; confirmă mesajul de eroare în română
- [ ] Confirmă că un client dezactivat nu apare în lista de alegere la comandă nouă
- [ ] Plimbă o comandă prin toate stările până la Facturată; confirmă că data documentelor se completează automat și că la final nu mai există butoane
- [ ] Anulează o altă comandă; confirmă că rămâne în listă marcată Anulată
- [ ] Filtrează lista după stare și caută după numărul comenzii și după referința clientului
- [ ] Deschide fișa unui client; confirmă că apar comenzile lui în „Comenzile acestui client"
- [ ] Modifică prețul unei comenzi în EUR; confirmă că echivalentul RON se schimbă, dar cursul și data lui rămân neschimbate
- [ ] Loghează-te cu a doua firmă; confirmă că nu vezi niciun client și nicio comandă a primei firme
- [ ] Fiind logat cu a doua firmă, deschide manual adresa unei comenzi a primei firme; confirmă 404
