# ONE x TMS — Fundament SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of ONE x TMS: self-service company signup, login, role-based access (Super Admin / Company Admin / Company User), strict multi-tenant data isolation, and a minimal admin panel to activate/suspend companies.

**Architecture:** Next.js 15 (App Router, TypeScript) monolith. PostgreSQL (Neon) via Prisma. Auth.js v5 (Credentials provider, JWT sessions). Tailwind + shadcn/ui. Resend for transactional invite emails. Deployed on Vercel.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, PostgreSQL (Neon), Auth.js v5 (`next-auth@beta`), bcryptjs, Resend, Tailwind CSS, shadcn/ui, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-15-one-x-tms-foundation-design.md](../specs/2026-08-15-one-x-tms-foundation-design.md)

## Global Constraints

- All user-facing text (labels, buttons, error messages) is in Romanian.
- Every function that reads or writes company-scoped data MUST go through `assertCompanyAccess` (from `lib/tenancy.ts`) or explicitly check `role === "SUPER_ADMIN"`. This is the core security invariant of the whole product — no exceptions.
- Passwords are never stored or logged in plain text; always hashed via `lib/auth/password.ts`.
- TypeScript strict mode; no `any` — session objects passed to data-access functions always use the `SessionUser` shape (`{ role: UserRole, companyId: string | null }`).
- No placeholder code, no `TODO` — every task ships working, tested code.

---

## Task 1: Inițializare proiect Next.js

**Files:**
- Create: whole Next.js project structure at repo root (`app/`, `lib/`, `components/`, `package.json`, `tsconfig.json`, etc.)

**Interfaces:**
- Produces: a working Next.js dev server, `@/*` import alias resolving to repo root.

- [ ] **Step 1: Rulează scaffolding-ul Next.js**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
```

Dacă întreabă dacă vrei să continui într-un folder care nu e gol (avem deja `docs/` și `.claude/`), răspunde `y`. Dacă întreabă despre Turbopack, alege opțiunea implicită (Yes).

- [ ] **Step 2: Verifică că pornește**

Run: `npm run dev`
Expected: server pornește pe `http://localhost:3000`, pagina implicită Next.js se încarcă în browser. Oprește serverul (Ctrl+C) după ce ai verificat.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: init Next.js project"
```

---

## Task 2: shadcn/ui + componente de bază

**Files:**
- Create: `components.json`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/badge.tsx`

**Interfaces:**
- Produces: `Button`, `Input`, `Label`, `Badge` din `@/components/ui/*`, folosite de toate paginile din task-urile următoare.

- [ ] **Step 1: Inițializează shadcn/ui**

Run: `npx shadcn@latest init`

Alege stilul implicit (New York sau Default — oricare), culoarea de bază neutră.

- [ ] **Step 2: Adaugă componentele de bază**

Run: `npx shadcn@latest add button input label badge`

- [ ] **Step 3: Verifică vizual**

Modifică temporar `app/page.tsx` să afișeze `<Button>Test</Button>`, rulează `npm run dev`, confirmă că butonul apare stilizat. Revino la conținutul inițial al `app/page.tsx` după verificare.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui base components"
```

---

## Task 3: Prisma + bază de date de dezvoltare (Neon)

**Files:**
- Create: `prisma/schema.prisma`, `.env` (necomis în git), `.env.example`, `lib/prisma.ts`
- Modify: `package.json` (script `build`), `.gitignore` (confirmă `.env*` ignorat, exceptând `.env.example`)

**Interfaces:**
- Produces: `prisma` (Prisma Client singleton) din `lib/prisma.ts`, modelele `Company`, `User`, `Invitation` cu enum-urile `CompanyStatus`, `UserRole`, `UserStatus`, `InvitationRole`, `InvitationStatus`.

- [ ] **Step 1: 🧑 Acțiune manuală — creează baza de date**

Creează cont pe [neon.tech](https://neon.tech) (gratuit). Creează un proiect nou numit `one-x-tms-dev`. Copiază connection string-ul (arată ca `postgresql://user:pass@host/dbname?sslmode=require`).

- [ ] **Step 2: Instalează Prisma**

```bash
npm install prisma @prisma/client
npx prisma init
```

- [ ] **Step 3: Scrie schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CompanyStatus {
  TRIAL
  ACTIVE
  SUSPENDED
}

enum UserRole {
  SUPER_ADMIN
  COMPANY_ADMIN
  COMPANY_USER
}

enum UserStatus {
  ACTIVE
  INVITED
  DISABLED
}

enum InvitationRole {
  COMPANY_ADMIN
  COMPANY_USER
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
}

model Company {
  id        String        @id @default(cuid())
  name      String
  cui       String
  status    CompanyStatus @default(TRIAL)
  createdAt DateTime      @default(now())

  users       User[]
  invitations Invitation[]
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  name         String
  role         UserRole
  companyId    String?
  jobTitle     String?
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now())

  company Company? @relation(fields: [companyId], references: [id])
}

model Invitation {
  id        String           @id @default(cuid())
  email     String
  companyId String
  role      InvitationRole
  token     String           @unique
  expiresAt DateTime
  status    InvitationStatus @default(PENDING)
  createdAt DateTime         @default(now())

  company Company @relation(fields: [companyId], references: [id])
}
```

- [ ] **Step 4: Configurează `.env`**

Write `.env` (adaugă/înlocuiește linia `DATABASE_URL`):
```
DATABASE_URL="<connection string-ul copiat de la Neon>"
```

Write `.env.example`:
```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
NEXTAUTH_SECRET=""
RESEND_API_KEY=""
APP_URL="http://localhost:3000"
```

- [ ] **Step 5: Rulează prima migrare**

Run: `npx prisma migrate dev --name init`
Expected: migrarea rulează cu succes, apar tabelele `Company`, `User`, `Invitation` (confirmă cu `npx prisma studio`, apoi închide-l).

- [ ] **Step 6: Creează Prisma Client singleton**

Write `lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 7: Adaugă script de build pregătit pentru producție**

Modify `package.json`, schimbă scriptul `build`:
```json
"build": "prisma generate && prisma migrate deploy && next build"
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Prisma schema and dev database"
```

---

## Task 4: Bază de date de test + Vitest

**Files:**
- Create: `.env.test` (necomis), `vitest.config.ts`, `tests/setup.ts`, `tests/helpers/db.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces: `resetDatabase()` din `tests/helpers/db.ts`, folosit de toate testele de integrare din task-urile următoare.

- [ ] **Step 1: 🧑 Acțiune manuală — a doua bază de date**

În același cont Neon, creează un al doilea proiect: `one-x-tms-test`. Copiază connection string-ul.

- [ ] **Step 2: Instalează dependențele de test**

```bash
npm install -D vitest dotenv
```

- [ ] **Step 3: Configurează `.env.test`**

Write `.env.test`:
```
DATABASE_URL="<connection string-ul bazei de test>"
```

- [ ] **Step 4: Aplică schema pe baza de test**

Run:
```bash
DATABASE_URL="<connection string-ul bazei de test>" npx prisma migrate deploy
```

(Pe Windows PowerShell: `$env:DATABASE_URL="<connection string>"; npx prisma migrate deploy`)

- [ ] **Step 5: Configurează Vitest**

Write `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Write `tests/setup.ts`:

```ts
import { config } from "dotenv";

config({ path: ".env.test" });
```

- [ ] **Step 6: Helper de curățare a bazei de test**

Write `tests/helpers/db.ts`:

```ts
import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
```

- [ ] **Step 7: Adaugă scriptul de test**

Modify `package.json`, în `scripts`:
```json
"test": "vitest run"
```

- [ ] **Step 8: Test de fum — confirmă că harness-ul funcționează**

Write `tests/helpers/db.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./db";

describe("resetDatabase", () => {
  it("golește tabelele", async () => {
    await prisma.company.create({ data: { name: "Test", cui: "RO1" } });
    await resetDatabase();
    const count = await prisma.company.count();
    expect(count).toBe(0);
  });
});
```

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test: set up Vitest with a dedicated test database"
```

---

## Task 5: Hashing parole

**Files:**
- Create: `lib/auth/password.ts`
- Test: `tests/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>` din `lib/auth/password.ts`.

- [ ] **Step 1: Instalează bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Scrie testul care eșuează**

Write `tests/auth/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifică o parolă corectă contra hash-ului ei", async () => {
    const hash = await hashPassword("parola-mea-123");
    expect(await verifyPassword("parola-mea-123", hash)).toBe(true);
  });

  it("respinge o parolă greșită", async () => {
    const hash = await hashPassword("parola-mea-123");
    expect(await verifyPassword("alta-parola", hash)).toBe(false);
  });

  it("nu stochează parola în clar în hash", async () => {
    const hash = await hashPassword("parola-mea-123");
    expect(hash).not.toContain("parola-mea-123");
  });
});
```

- [ ] **Step 2: Rulează testul, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/auth/password.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Rulează testul, confirmă succesul**

Run: `npm test`
Expected: PASS (toate testele).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add password hashing helpers"
```

---

## Task 6: Invariantul de izolare între firme (tenancy guard)

**Files:**
- Create: `lib/tenancy.ts`
- Test: `tests/tenancy.test.ts`

**Interfaces:**
- Consumes: `UserRole` din `@prisma/client` (Task 3).
- Produces: `SessionUser` type, `TenantAccessError` class, `assertCompanyAccess(session: SessionUser, targetCompanyId: string): void` din `lib/tenancy.ts` — folosite de toate funcțiile de acces la date din task-urile următoare.

- [ ] **Step 1: Scrie testul care eșuează**

Write `tests/tenancy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assertCompanyAccess, TenantAccessError, type SessionUser } from "@/lib/tenancy";

describe("assertCompanyAccess", () => {
  it("permite accesul unui utilizator la propria firmă", () => {
    const session: SessionUser = { role: "COMPANY_ADMIN", companyId: "company-a" };
    expect(() => assertCompanyAccess(session, "company-a")).not.toThrow();
  });

  it("respinge accesul unui utilizator la altă firmă", () => {
    const session: SessionUser = { role: "COMPANY_ADMIN", companyId: "company-a" };
    expect(() => assertCompanyAccess(session, "company-b")).toThrow(TenantAccessError);
  });

  it("permite Super Admin să acceseze orice firmă", () => {
    const session: SessionUser = { role: "SUPER_ADMIN", companyId: null };
    expect(() => assertCompanyAccess(session, "company-b")).not.toThrow();
  });
});
```

- [ ] **Step 2: Rulează testul, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/tenancy.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/tenancy.ts`:

```ts
import type { UserRole } from "@prisma/client";

export class TenantAccessError extends Error {
  constructor() {
    super("Cross-tenant access denied");
    this.name = "TenantAccessError";
  }
}

export type SessionUser = {
  role: UserRole;
  companyId: string | null;
};

export function assertCompanyAccess(session: SessionUser, targetCompanyId: string): void {
  if (session.role === "SUPER_ADMIN") return;
  if (session.companyId !== targetCompanyId) {
    throw new TenantAccessError();
  }
}
```

- [ ] **Step 4: Rulează testul, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add tenant isolation guard (assertCompanyAccess)"
```

---

## Task 7: Funcții de acces la date — Company & User (scoped)

**Files:**
- Create: `lib/data/companies.ts`, `lib/data/users.ts`, `lib/data/registerCompany.ts`
- Test: `tests/data/users.test.ts`, `tests/data/registerCompany.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `SessionUser`/`assertCompanyAccess` (Task 6), `hashPassword` (Task 5).
- Produces:
  - `getUsersForCompany(session: SessionUser, companyId: string)` din `lib/data/users.ts`
  - `getCompanyForSession(session: SessionUser)`, `listCompaniesForSuperAdmin(session: { role: UserRole })`, `updateCompanyStatus(session: { role: UserRole }, companyId: string, status: CompanyStatus)`, `ForbiddenError` din `lib/data/companies.ts`
  - `registerCompany(input: { companyName: string; cui: string; adminName: string; email: string; password: string })`, `EmailAlreadyExistsError` din `lib/data/registerCompany.ts`

- [ ] **Step 1: Scrie testul de izolare care eșuează**

Write `tests/data/users.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { getUsersForCompany } from "@/lib/data/users";
import { TenantAccessError } from "@/lib/tenancy";

describe("getUsersForCompany", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar utilizatorii firmei cerute, nu și pe ai altei firme", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const companyB = await prisma.company.create({ data: { name: "Firma B", cui: "RO2" } });

    await prisma.user.create({
      data: { email: "admin-a@test.ro", passwordHash: "x", name: "Admin A", role: "COMPANY_ADMIN", companyId: companyA.id },
    });
    await prisma.user.create({
      data: { email: "admin-b@test.ro", passwordHash: "x", name: "Admin B", role: "COMPANY_ADMIN", companyId: companyB.id },
    });

    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };
    const result = await getUsersForCompany(session, companyA.id);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("admin-a@test.ro");
  });

  it("respinge o cerere pentru o altă firmă decât cea din sesiune", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const companyB = await prisma.company.create({ data: { name: "Firma B", cui: "RO2" } });

    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };

    await expect(getUsersForCompany(session, companyB.id)).rejects.toThrow(TenantAccessError);
  });

  it("permite Super Admin să vadă utilizatorii oricărei firme", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    await prisma.user.create({
      data: { email: "admin-a@test.ro", passwordHash: "x", name: "Admin A", role: "COMPANY_ADMIN", companyId: companyA.id },
    });

    const session = { role: "SUPER_ADMIN" as const, companyId: null };
    const result = await getUsersForCompany(session, companyA.id);

    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/users.ts` nu există.

- [ ] **Step 3: Implementează `lib/data/users.ts`**

Write `lib/data/users.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export async function getUsersForCompany(session: SessionUser, companyId: string) {
  assertCompanyAccess(session, companyId);
  return prisma.user.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
}
```

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Scrie testul pentru `registerCompany`**

Write `tests/data/registerCompany.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { registerCompany, EmailAlreadyExistsError } from "@/lib/data/registerCompany";

describe("registerCompany", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează o firmă TRIAL și un admin de firmă", async () => {
    const { company, user } = await registerCompany({
      companyName: "Transport SRL",
      cui: "RO123",
      adminName: "Ion Pop",
      email: "ion@transport.ro",
      password: "parola123",
    });

    expect(company.status).toBe("TRIAL");
    expect(user.role).toBe("COMPANY_ADMIN");
    expect(user.companyId).toBe(company.id);
    expect(user.passwordHash).not.toBe("parola123");
  });

  it("respinge un email deja folosit", async () => {
    await registerCompany({
      companyName: "Transport SRL",
      cui: "RO123",
      adminName: "Ion Pop",
      email: "ion@transport.ro",
      password: "parola123",
    });

    await expect(
      registerCompany({
        companyName: "Alta Firma SRL",
        cui: "RO999",
        adminName: "Alt Admin",
        email: "ion@transport.ro",
        password: "altaparola",
      })
    ).rejects.toThrow(EmailAlreadyExistsError);
  });
});
```

- [ ] **Step 6: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/registerCompany.ts` nu există.

- [ ] **Step 7: Implementează `lib/data/registerCompany.ts`**

Write `lib/data/registerCompany.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("Există deja un cont cu acest email.");
    this.name = "EmailAlreadyExistsError";
  }
}

export async function registerCompany(input: {
  companyName: string;
  cui: string;
  adminName: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new EmailAlreadyExistsError();

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.companyName, cui: input.cui, status: "TRIAL" },
    });
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.adminName,
        role: "COMPANY_ADMIN",
        companyId: company.id,
        status: "ACTIVE",
      },
    });
    return { company, user };
  });
}
```

- [ ] **Step 8: Rulează testele, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Implementează `lib/data/companies.ts`** (fără test dedicat — funcții simple, acoperite de testele manuale din Task 18)

Write `lib/data/companies.ts`:

```ts
import type { CompanyStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/tenancy";

export class ForbiddenError extends Error {
  constructor() {
    super("Doar Super Admin poate face această acțiune.");
    this.name = "ForbiddenError";
  }
}

export async function getCompanyForSession(session: SessionUser) {
  if (!session.companyId) return null;
  return prisma.company.findUnique({ where: { id: session.companyId } });
}

export async function listCompaniesForSuperAdmin(session: { role: UserRole }) {
  if (session.role !== "SUPER_ADMIN") throw new ForbiddenError();
  return prisma.company.findMany({ orderBy: { createdAt: "desc" } });
}

export async function updateCompanyStatus(
  session: { role: UserRole },
  companyId: string,
  status: CompanyStatus
) {
  if (session.role !== "SUPER_ADMIN") throw new ForbiddenError();
  return prisma.company.update({ where: { id: companyId }, data: { status } });
}
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add tenant-scoped data access for companies and users"
```

---

## Task 8: Auth.js — configurare, sesiune JWT, tipuri

**Files:**
- Create: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `next-auth.d.ts`, `lib/auth/checkLoginAllowed.ts`
- Test: `tests/auth/checkLoginAllowed.test.ts`

**Interfaces:**
- Consumes: `verifyPassword` (Task 5), `prisma` (Task 3).
- Produces: `checkLoginAllowed(user, company): { ok: true } | { ok: false; reason: string }` din `lib/auth/checkLoginAllowed.ts`; `auth`, `signIn`, `signOut`, `handlers` din `@/auth`; `session.user.role` și `session.user.companyId` tipate corect peste tot în proiect.

- [ ] **Step 1: Instalează Auth.js**

```bash
npm install next-auth@beta
```

- [ ] **Step 2: Scrie testul pentru regula de blocare a login-ului**

Write `tests/auth/checkLoginAllowed.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkLoginAllowed } from "@/lib/auth/checkLoginAllowed";

describe("checkLoginAllowed", () => {
  it("blochează un utilizator dezactivat", () => {
    const result = checkLoginAllowed({ status: "DISABLED", role: "COMPANY_USER" }, { status: "ACTIVE" });
    expect(result.ok).toBe(false);
  });

  it("blochează un utilizator dintr-o firmă suspendată", () => {
    const result = checkLoginAllowed({ status: "ACTIVE", role: "COMPANY_USER" }, { status: "SUSPENDED" });
    expect(result.ok).toBe(false);
  });

  it("permite Super Admin indiferent de firmă", () => {
    const result = checkLoginAllowed({ status: "ACTIVE", role: "SUPER_ADMIN" }, null);
    expect(result.ok).toBe(true);
  });

  it("permite un utilizator activ dintr-o firmă activă", () => {
    const result = checkLoginAllowed({ status: "ACTIVE", role: "COMPANY_USER" }, { status: "ACTIVE" });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Rulează testul, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/auth/checkLoginAllowed.ts` nu există.

- [ ] **Step 4: Implementează**

Write `lib/auth/checkLoginAllowed.ts`:

```ts
import type { Company, User } from "@prisma/client";

export type LoginCheckResult = { ok: true } | { ok: false; reason: string };

export function checkLoginAllowed(
  user: Pick<User, "status" | "role">,
  company: Pick<Company, "status"> | null
): LoginCheckResult {
  if (user.status === "DISABLED") {
    return { ok: false, reason: "Acest cont a fost dezactivat." };
  }
  if (user.role !== "SUPER_ADMIN" && company?.status === "SUSPENDED") {
    return { ok: false, reason: "Firma ta este suspendată. Contactează administratorul." };
  }
  return { ok: true };
}
```

- [ ] **Step 5: Rulează testul, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Extinde tipurile Auth.js**

Write `next-auth.d.ts`:

```ts
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    companyId: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      companyId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    companyId: string | null;
  }
}
```

- [ ] **Step 7: Configurează Auth.js**

Write `auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginAllowed } from "@/lib/auth/checkLoginAllowed";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        });
        if (!user) return null;

        const passwordOk = await verifyPassword(password, user.passwordHash);
        if (!passwordOk) return null;

        const allowed = checkLoginAllowed(user, user.company);
        if (!allowed.ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.role = token.role;
      session.user.companyId = token.companyId;
      return session;
    },
  },
});
```

- [ ] **Step 8: Ruta API**

Write `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 9: 🧑 Acțiune manuală — secretul de sesiune**

Run: `npx auth secret`
(generează automat `NEXTAUTH_SECRET` și îl adaugă în `.env`)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: configure Auth.js with Credentials provider"
```

---

## Task 9: Pagina de login

**Files:**
- Create: `app/login/page.tsx`, `app/login/actions.ts`

**Interfaces:**
- Consumes: `signIn` din `@/auth` (Task 8).

- [ ] **Step 1: Server action de login**

Write `app/login/actions.ts`:

```ts
"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(_prevState: { error: string | null }, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email sau parolă incorectă, sau cont fără acces." };
    }
    throw error;
  }
}
```

- [ ] **Step 2: Pagina**

Write `app/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Autentificare</h1>
      <form action={formAction} className="space-y-4">
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Parolă" required />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se autentifică..." : "Intră în cont"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verifică manual**

Run: `npm run dev`, deschide `/login` în browser. Deocamdată nu există niciun cont — confirmă doar că formularul arată bine și că trimiterea lui cu date greșite afișează mesajul de eroare.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add login page"
```

---

## Task 10: Înregistrare firmă (self-service)

**Files:**
- Create: `app/inregistrare/page.tsx`, `app/inregistrare/actions.ts`

**Interfaces:**
- Consumes: `registerCompany`, `EmailAlreadyExistsError` (Task 7); `signIn` (Task 8).

- [ ] **Step 1: Server action**

Write `app/inregistrare/actions.ts`:

```ts
"use server";

import { registerCompany, EmailAlreadyExistsError } from "@/lib/data/registerCompany";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function registerAction(_prevState: { error: string | null }, formData: FormData) {
  const companyName = formData.get("companyName") as string;
  const cui = formData.get("cui") as string;
  const adminName = formData.get("adminName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await registerCompany({ companyName, cui, adminName, email, password });
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Firma a fost creată, dar autentificarea automată a eșuat. Încearcă să te loghezi manual." };
    }
    throw error;
  }
}
```

- [ ] **Step 2: Pagina**

Write `app/inregistrare/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { registerAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, { error: null });

  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Înregistrează firma ta</h1>
      <form action={formAction} className="space-y-4">
        <Input name="companyName" placeholder="Numele firmei" required />
        <Input name="cui" placeholder="CUI" required />
        <Input name="adminName" placeholder="Numele tău" required />
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Alege o parolă" required minLength={8} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se creează firma..." : "Creează cont"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verifică manual**

Run: `npm run dev`, deschide `/inregistrare`, completează formularul, confirmă redirect la `/dashboard` (pagina nu există încă — va da 404, e ok deocamdată). Confirmă cu `npx prisma studio` că firma și userul au fost create corect. Încearcă din nou cu același email — confirmă mesajul de eroare.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add self-service company registration"
```

---

## Task 11: Ghidaj rute pe rol (route guard)

**Files:**
- Create: `lib/auth/routeGuard.ts`, `middleware.ts`
- Test: `tests/auth/routeGuard.test.ts`

**Interfaces:**
- Produces: `decideRedirect(pathname: string, session: RouteSession): string | null` din `lib/auth/routeGuard.ts`.

- [ ] **Step 1: Scrie testul care eșuează**

Write `tests/auth/routeGuard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decideRedirect } from "@/lib/auth/routeGuard";

describe("decideRedirect", () => {
  it("trimite la /login un vizitator neautentificat care intră pe /dashboard", () => {
    expect(decideRedirect("/dashboard", null)).toBe("/login");
  });

  it("trimite la /login un vizitator neautentificat care intră pe /admin", () => {
    expect(decideRedirect("/admin", null)).toBe("/login");
  });

  it("trimite un utilizator obișnuit departe de /admin", () => {
    expect(decideRedirect("/admin", { role: "COMPANY_ADMIN" })).toBe("/dashboard");
  });

  it("trimite Super Admin departe de /dashboard, spre /admin", () => {
    expect(decideRedirect("/dashboard", { role: "SUPER_ADMIN" })).toBe("/admin");
  });

  it("nu redirecționează un Super Admin autentificat pe /admin", () => {
    expect(decideRedirect("/admin", { role: "SUPER_ADMIN" })).toBeNull();
  });

  it("nu redirecționează un utilizator obișnuit autentificat pe /dashboard", () => {
    expect(decideRedirect("/dashboard", { role: "COMPANY_USER" })).toBeNull();
  });

  it("nu afectează rute publice", () => {
    expect(decideRedirect("/login", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rulează testul, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/auth/routeGuard.ts` nu există.

- [ ] **Step 3: Implementează**

Write `lib/auth/routeGuard.ts`:

```ts
import type { UserRole } from "@prisma/client";

export type RouteSession = { role: UserRole } | null;

export function decideRedirect(pathname: string, session: RouteSession): string | null {
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");

  if ((isAdminRoute || isDashboardRoute) && !session) {
    return "/login";
  }
  if (isAdminRoute && session && session.role !== "SUPER_ADMIN") {
    return "/dashboard";
  }
  if (isDashboardRoute && session && session.role === "SUPER_ADMIN") {
    return "/admin";
  }
  return null;
}
```

- [ ] **Step 4: Rulează testul, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Conectează la middleware Next.js**

Write `middleware.ts`:

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { decideRedirect } from "@/lib/auth/routeGuard";

export default auth((req) => {
  const session = req.auth ? { role: req.auth.user.role } : null;
  const redirectTo = decideRedirect(req.nextUrl.pathname, session);

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add role-based route guard middleware"
```

---

## Task 12: Panou Super Admin — listă firme

**Files:**
- Create: `app/admin/page.tsx`, `app/admin/actions.ts`

**Interfaces:**
- Consumes: `listCompaniesForSuperAdmin`, `updateCompanyStatus` (Task 7); `auth` (Task 8); `decideRedirect`/middleware (Task 11) protejează deja ruta.

- [ ] **Step 1: Server actions**

Write `app/admin/actions.ts`:

```ts
"use server";

import { auth } from "@/auth";
import { updateCompanyStatus } from "@/lib/data/companies";
import { revalidatePath } from "next/cache";
import type { CompanyStatus } from "@prisma/client";

export async function setCompanyStatusAction(companyId: string, status: CompanyStatus) {
  const session = await auth();
  if (!session) throw new Error("Neautentificat");

  await updateCompanyStatus({ role: session.user.role }, companyId, status);
  revalidatePath("/admin");
}
```

- [ ] **Step 2: Pagina**

Write `app/admin/page.tsx`:

```tsx
import { auth } from "@/auth";
import { listCompaniesForSuperAdmin } from "@/lib/data/companies";
import { setCompanyStatusAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();
  const companies = await listCompaniesForSuperAdmin({ role: session!.user.role });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Firme înregistrate</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nume</th>
            <th className="py-2">CUI</th>
            <th className="py-2">Status</th>
            <th className="py-2">Acțiuni</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b">
              <td className="py-2">
                <Link href={`/admin/firme/${company.id}`} className="underline">
                  {company.name}
                </Link>
              </td>
              <td className="py-2">{company.cui}</td>
              <td className="py-2">
                <Badge>{company.status}</Badge>
              </td>
              <td className="space-x-2 py-2">
                <form action={setCompanyStatusAction.bind(null, company.id, "ACTIVE")} className="inline">
                  <Button size="sm" variant="outline" type="submit">
                    Activează
                  </Button>
                </form>
                <form action={setCompanyStatusAction.bind(null, company.id, "SUSPENDED")} className="inline">
                  <Button size="sm" variant="destructive" type="submit">
                    Suspendă
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Creează manual primul Super Admin**

Deschide `npx prisma studio`, adaugă manual un rând în tabelul `User`: `email`, `passwordHash` (generează unul rulând temporar `node -e "require('bcryptjs').hash('parola-ta', 10).then(console.log)"` și copiază rezultatul), `name`, `role = SUPER_ADMIN`, `companyId = null`, `status = ACTIVE`.

- [ ] **Step 4: Verifică manual**

Loghează-te cu contul de Super Admin creat, confirmă redirect automat la `/admin`, confirmă că vezi firma înregistrată la Task 10 cu status `TRIAL`, apasă „Activează”, confirmă că statusul se schimbă în `ACTIVE`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Super Admin company list and activation"
```

---

## Task 13: Panou Super Admin — detaliu firmă

**Files:**
- Create: `app/admin/firme/[id]/page.tsx`

**Interfaces:**
- Consumes: `getUsersForCompany` (Task 7), `prisma` (Task 3).

- [ ] **Step 1: Pagina**

Write `app/admin/firme/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUsersForCompany } from "@/lib/data/users";
import { TenantAccessError } from "@/lib/tenancy";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  let users;
  try {
    users = await getUsersForCompany({ role: session!.user.role, companyId: session!.user.companyId }, id);
  } catch (error) {
    if (error instanceof TenantAccessError) notFound();
    throw error;
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id } });

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{company.name}</h1>
      <p className="text-muted-foreground">
        CUI: {company.cui} · Status: {company.status}
      </p>
      <h2 className="mb-2 mt-6 text-lg font-medium">Utilizatori</h2>
      <ul className="space-y-1">
        {users.map((u) => (
          <li key={u.id}>
            {u.name} — {u.email} ({u.role})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verifică manual**

Din `/admin`, dă click pe numele firmei, confirmă că pagina de detaliu arată CUI, status și lista de utilizatori (cel puțin admin-ul de firmă creat la Task 10).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add company detail page for Super Admin"
```

---

## Task 14: Dashboard firmă (shell)

**Files:**
- Create: `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `auth` (Task 8), `getCompanyForSession` (Task 7).

- [ ] **Step 1: Layout cu navigare**

Write `app/dashboard/layout.tsx`:

```tsx
import { auth } from "@/auth";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen">
      <nav className="flex gap-4 border-b p-4">
        <Link href="/dashboard" className="font-semibold">
          ONE x TMS
        </Link>
        {session?.user.role === "COMPANY_ADMIN" && <Link href="/dashboard/echipa">Echipă</Link>}
      </nav>
      <main className="p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Pagina principală**

Write `app/dashboard/page.tsx`:

```tsx
import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";

export default async function DashboardPage() {
  const session = await auth();
  const company = await getCompanyForSession({ role: session!.user.role, companyId: session!.user.companyId });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bine ai venit, {session!.user.name}</h1>
      {company?.status === "TRIAL" && (
        <p className="mt-2 text-amber-600">
          Firma ta este în așteptare de activare. Vei fi contactat în curând.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verifică manual**

Loghează-te cu contul de firmă creat la Task 10 (dacă firma e încă `TRIAL`, ar trebui să vezi mesajul de așteptare; dacă ai activat-o la Task 12, mesajul nu mai apare).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add dashboard shell"
```

---

## Task 15: Invitații — creare + trimitere email

**Files:**
- Create: `lib/data/invitations.ts`, `lib/email/sendInvite.ts`
- Test: `tests/data/invitations.test.ts`

**Interfaces:**
- Consumes: `assertCompanyAccess`, `SessionUser` (Task 6); `hashPassword` (Task 5); `prisma` (Task 3).
- Produces: `createInvitation(session, input)`, `acceptInvitation(token, input)`, `InvalidInvitationError` din `lib/data/invitations.ts`; `sendInviteEmail(to, companyName, token)` din `lib/email/sendInvite.ts`.

- [ ] **Step 1: 🧑 Acțiune manuală — cont Resend**

Creează cont gratuit pe [resend.com](https://resend.com), generează un API key. Adaugă în `.env`:
```
RESEND_API_KEY="<key-ul tău>"
APP_URL="http://localhost:3000"
```

- [ ] **Step 2: Instalează Resend**

```bash
npm install resend
```

- [ ] **Step 3: Scrie testele care eșuează**

Write `tests/data/invitations.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createInvitation, acceptInvitation, InvalidInvitationError } from "@/lib/data/invitations";
import { TenantAccessError } from "@/lib/tenancy";

describe("createInvitation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează o invitație validă 7 zile", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const invitation = await createInvitation(session, {
      companyId: company.id,
      email: "coleg@test.ro",
      role: "COMPANY_USER",
    });

    expect(invitation.status).toBe("PENDING");
    expect(invitation.token).toHaveLength(64);
    const daysUntilExpiry = (invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);
  });

  it("respinge invitarea pentru o altă firmă decât cea din sesiune", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const companyB = await prisma.company.create({ data: { name: "Firma B", cui: "RO2" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };

    await expect(
      createInvitation(session, { companyId: companyB.id, email: "x@test.ro", role: "COMPANY_USER" })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("acceptInvitation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un utilizator activ și marchează invitația ca acceptată", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const invitation = await createInvitation(session, {
      companyId: company.id,
      email: "coleg@test.ro",
      role: "COMPANY_USER",
    });

    const user = await acceptInvitation(invitation.token, { name: "Coleg Nou", password: "parola123" });

    expect(user.email).toBe("coleg@test.ro");
    expect(user.role).toBe("COMPANY_USER");
    expect(user.status).toBe("ACTIVE");

    const updated = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(updated.status).toBe("ACCEPTED");
  });

  it("respinge un token inexistent", async () => {
    await expect(acceptInvitation("token-invalid", { name: "X", password: "parola123" })).rejects.toThrow(
      InvalidInvitationError
    );
  });

  it("respinge o invitație deja acceptată", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const invitation = await createInvitation(session, {
      companyId: company.id,
      email: "coleg@test.ro",
      role: "COMPANY_USER",
    });

    await acceptInvitation(invitation.token, { name: "Coleg", password: "parola123" });

    await expect(acceptInvitation(invitation.token, { name: "Coleg", password: "altaparola" })).rejects.toThrow(
      InvalidInvitationError
    );
  });

  it("respinge o invitație expirată", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const invitation = await prisma.invitation.create({
      data: {
        email: "coleg@test.ro",
        companyId: company.id,
        role: "COMPANY_USER",
        token: "token-expirat",
        expiresAt: new Date(Date.now() - 1000),
        status: "PENDING",
      },
    });

    await expect(
      acceptInvitation(invitation.token, { name: "Coleg", password: "parola123" })
    ).rejects.toThrow(InvalidInvitationError);
  });
});
```

- [ ] **Step 4: Rulează testele, confirmă eșecul**

Run: `npm test`
Expected: FAIL — `lib/data/invitations.ts` nu există.

- [ ] **Step 5: Implementează**

Write `lib/data/invitations.ts`:

```ts
import { randomBytes } from "crypto";
import type { InvitationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { hashPassword } from "@/lib/auth/password";

export class InvalidInvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInvitationError";
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvitation(
  session: SessionUser,
  input: { companyId: string; email: string; role: InvitationRole }
) {
  assertCompanyAccess(session, input.companyId);

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new InvalidInvitationError("Există deja un cont cu acest email.");

  const token = randomBytes(32).toString("hex");
  return prisma.invitation.create({
    data: {
      email: input.email,
      companyId: input.companyId,
      role: input.role,
      token,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
      status: "PENDING",
    },
  });
}

export async function acceptInvitation(token: string, input: { name: string; password: string }) {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) throw new InvalidInvitationError("Invitație inexistentă.");
  if (invitation.status !== "PENDING") throw new InvalidInvitationError("Această invitație a fost deja folosită.");
  if (invitation.expiresAt < new Date()) throw new InvalidInvitationError("Această invitație a expirat.");

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        name: input.name,
        role: invitation.role,
        companyId: invitation.companyId,
        status: "ACTIVE",
      },
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
    return user;
  });
}
```

- [ ] **Step 6: Rulează testele, confirmă succesul**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Trimitere email (fără test automat — serviciu extern)**

Write `lib/email/sendInvite.ts`:

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail(to: string, companyName: string, token: string) {
  const url = `${process.env.APP_URL}/invitatie/${token}`;
  await resend.emails.send({
    from: "ONE x TMS <onboarding@resend.dev>",
    to,
    subject: `Ai fost invitat în ${companyName} pe ONE x TMS`,
    html: `<p>Ai fost invitat să te alături firmei <strong>${companyName}</strong> pe ONE x TMS.</p><p><a href="${url}">Acceptă invitația</a></p>`,
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add invitation creation, acceptance, and email sending"
```

---

## Task 16: Pagina „Echipă” + acceptare invitație

**Files:**
- Create: `app/dashboard/echipa/page.tsx`, `app/dashboard/echipa/invite-form.tsx`, `app/dashboard/echipa/actions.ts`, `app/invitatie/[token]/page.tsx`, `app/invitatie/[token]/actions.ts`

**Interfaces:**
- Consumes: `getUsersForCompany` (Task 7), `createInvitation`/`acceptInvitation`/`InvalidInvitationError` (Task 15), `sendInviteEmail` (Task 15), `signIn` (Task 8).

- [ ] **Step 1: Server action de invitare**

Write `app/dashboard/echipa/actions.ts`:

```ts
"use server";

import { auth } from "@/auth";
import { createInvitation, InvalidInvitationError } from "@/lib/data/invitations";
import { sendInviteEmail } from "@/lib/email/sendInvite";
import { revalidatePath } from "next/cache";
import type { InvitationRole } from "@prisma/client";

export async function inviteUserAction(_prevState: { error: string | null }, formData: FormData) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const email = formData.get("email") as string;
  const role = formData.get("role") as InvitationRole;

  try {
    const invitation = await createInvitation(
      { role: session.user.role, companyId: session.user.companyId },
      { companyId: session.user.companyId, email, role }
    );
    await sendInviteEmail(email, session.user.name ?? "firma ta", invitation.token);
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/dashboard/echipa");
  return { error: null };
}
```

- [ ] **Step 2: Formular de invitare (component client)**

Write `app/dashboard/echipa/invite-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { inviteUserAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUserAction, { error: null });

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Input name="email" type="email" placeholder="Email coleg" required />
      <select name="role" className="rounded border px-2 py-2 text-sm" defaultValue="COMPANY_USER">
        <option value="COMPANY_USER">Utilizator</option>
        <option value="COMPANY_ADMIN">Admin firmă</option>
      </select>
      <Button type="submit" disabled={pending}>
        Invită
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Pagina Echipă**

Write `app/dashboard/echipa/page.tsx`:

```tsx
import { auth } from "@/auth";
import { getUsersForCompany } from "@/lib/data/users";
import { InviteForm } from "./invite-form";

export default async function EchipaPage() {
  const session = await auth();
  const users = await getUsersForCompany(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Echipă</h1>
      <ul className="mb-8 space-y-2">
        {users.map((u) => (
          <li key={u.id} className="flex justify-between border-b py-2">
            <span>
              {u.name} ({u.email})
            </span>
            <span className="text-sm text-muted-foreground">
              {u.role} · {u.status}
            </span>
          </li>
        ))}
      </ul>
      <InviteForm />
    </div>
  );
}
```

- [ ] **Step 4: Server action de acceptare invitație**

Write `app/invitatie/[token]/actions.ts`:

```ts
"use server";

import { acceptInvitation, InvalidInvitationError } from "@/lib/data/invitations";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function acceptInvitationAction(
  token: string,
  _prevState: { error: string | null },
  formData: FormData
) {
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;

  let email: string;
  try {
    const user = await acceptInvitation(token, { name, password });
    email = user.email;
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Cont creat, dar autentificarea automată a eșuat. Loghează-te manual." };
    }
    throw error;
  }
}
```

- [ ] **Step 5: Pagina de acceptare**

Write `app/invitatie/[token]/page.tsx`:

```tsx
"use client";

import { use, useActionState } from "react";
import { acceptInvitationAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const boundAction = acceptInvitationAction.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, { error: null });

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Finalizează contul</h1>
      <form action={formAction} className="space-y-4">
        <Input name="name" placeholder="Numele tău" required />
        <Input name="password" type="password" placeholder="Alege o parolă" required minLength={8} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se creează contul..." : "Creează cont"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Verifică manual**

Loghează-te ca admin de firmă, mergi pe `/dashboard/echipa`, invită un email al tău secundar (sau folosește adresa ta cu un `+test`, ex: `tu+test@gmail.com`), confirmă că primești emailul (verifică și folderul Spam), deschide link-ul, completează formularul, confirmă că ești logat automat pe `/dashboard` și că apari în lista Echipă.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add team invitation flow"
```

---

## Task 17: Deploy pe Vercel

**Files:** niciunul nou — doar configurare externă și o a treia bază de date (producție).

- [ ] **Step 1: 🧑 Acțiune manuală — repo GitHub**

Creează un repo nou (privat) pe [github.com](https://github.com), gol, fără README. Copiază URL-ul.

Run:
```bash
git remote add origin <url-ul repo-ului>
git push -u origin master
```

- [ ] **Step 2: 🧑 Acțiune manuală — a treia bază de date**

În Neon, creează un al treilea proiect: `one-x-tms-prod`. Copiază connection string-ul.

- [ ] **Step 3: 🧑 Acțiune manuală — proiect Vercel**

Pe [vercel.com](https://vercel.com), „Add New Project”, importă repo-ul de GitHub. Înainte de deploy, adaugă variabilele de mediu (Environment Variables):
- `DATABASE_URL` = connection string-ul de producție
- `NEXTAUTH_SECRET` = același tip de valoare generată la Task 8 (rulează din nou `npx auth secret` local dacă vrei una diferită de dev)
- `RESEND_API_KEY` = key-ul tău Resend
- `APP_URL` = domeniul pe care ți-l dă Vercel (îl completezi după primul deploy, apoi redeploy)

Apasă Deploy.

- [ ] **Step 4: Creează Super Admin în producție**

După ce deploy-ul reușește (build-ul rulează automat `prisma migrate deploy`, deci tabelele există deja), conectează-te la baza de producție cu `DATABASE_URL` de producție și `npx prisma studio`, adaugă manual contul de Super Admin (la fel ca la Task 12, Step 3).

- [ ] **Step 5: Verifică manual**

Deschide URL-ul de producție, testează login cu Super Admin, testează `/inregistrare` cu o firmă de test.

---

## Task 18: Checklist final de testare manuală

Nu adaugă cod — e verificarea end-to-end a întregului modul, de rulat local sau pe producție.

- [ ] Înregistrează Firma A prin `/inregistrare` — confirmă redirect la `/dashboard` cu mesaj de „în așteptare de activare”
- [ ] Deschide un tab nou, înregistrează Firma B cu alt email
- [ ] Loghează-te ca admin Firma A pe `/dashboard/echipa` — confirmă că vezi doar userii Firmei A
- [ ] Loghează-te ca Super Admin pe `/admin` — confirmă că vezi ambele firme, ambele `TRIAL`
- [ ] Activează Firma A din `/admin` — confirmă status devine `ACTIVE`
- [ ] Suspendă Firma B din `/admin`
- [ ] Încearcă login cu contul Firmei B — confirmă mesaj de blocare, fără acces
- [ ] Ca admin Firma A, invită un coleg din `/dashboard/echipa` — confirmă email primit
- [ ] Acceptă invitația — confirmă cont creat, login automat, userul apare în lista Echipă a Firmei A
- [ ] Încearcă să accesezi manual `/admin/firme/<id-ul Firmei B>` fiind logat ca admin Firma A — confirmă că primești o eroare (nu vezi datele Firmei B)
- [ ] Delogare, încearcă acces direct la `/dashboard` și `/admin` — confirmă redirect la `/login`

---
