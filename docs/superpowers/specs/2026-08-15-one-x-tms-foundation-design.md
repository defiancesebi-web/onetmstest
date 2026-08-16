# ONE x TMS — Fundament SaaS (Auth + Multi-tenancy + Admin firme)

## Context

ONE x TMS este un produs SaaS comercial (nu un sistem custom pentru o singură
firmă) destinat transportatorilor rutieri de marfă (FTL/LTL), inspirat din
TMS-uri existente pe piață (Routena, fireTMS, Impargo). Este construit
incremental, modul cu modul, de un dezvoltator la nivel de începător,
asistat integral de Claude Code, la un ritm de 3-5 ore/săptămână.

### Fazare clienți (context, nu parte din acest spec)

- **Faza 1**: transportatori rutieri (firme cu flotă proprie)
- **Faza 2** (după ce faza 1 e stabilă): case de expediție / forwarderi
  (firme care intermediază transport, fără flotă proprie sau cu flotă mixtă)

### Roadmap general (context, nu parte din acest spec)

Ținta de beta = module 1-7, toate livrate ca **aplicație web, responsive**
(utilizabilă de pe telefon/tabletă direct din browser — inclusiv de
dispeceri și șoferi, ca soluție tranzitorie până la aplicațiile native).

1. **Fundament SaaS** — acest document
2. Comenzi de transport (Orders/Loads)
3. Flotă & Șoferi
4. Dispecerat / Planificare
5. Facturare de bază
6. Tracking simplu (status manual)
7. Rapoarte de bază

**Post-beta**, sub-proiecte separate, fiecare cu propriul spec:

- **Aplicații mobile native** (Expo / React Native) pentru șofer și
  dispecer — motivat de nevoia de GPS live în fundal (tracking continuu
  fără ca aplicația să stea deschisă), notificări push și acces la
  cameră pentru POD/CMR, funcționalități pe care web-ul responsive nu le
  poate oferi la același nivel. Pornește după ce modulele 1-7 rulează cu
  clienți reali și se știe clar ce workflow-uri au nevoie de aplicație
  dedicată.
- e-Factura/ANAF, GPS live (telematică flotă), tahograf, portal client,
  AI-fill din documente

## Scopul acestui modul

Fundația fără de care niciun alt modul nu poate exista ca produs comercial:
înregistrare firme, autentificare, izolare completă a datelor între firme
(multi-tenancy), și un panou minimal de administrare a platformei.

## Arhitectură

- **Framework**: Next.js (TypeScript), monolit — UI și API în același proiect
- **Bază de date**: PostgreSQL găzduit (Neon)
- **ORM**: Prisma
- **Autentificare**: Auth.js (NextAuth), provider Credentials (email + parolă)
- **UI**: Tailwind CSS + shadcn/ui
- **Deploy**: Vercel, conectat la un repo GitHub (deploy automat la fiecare
  modificare aprobată pe branch-ul principal)

## Model de date

### Company (firmă / tenant)

| Câmp | Tip | Note |
|---|---|---|
| id | string (cuid) | |
| name | string | Nume firmă |
| cui | string | Cod fiscal — capturat de acum, nefolosit încă (pregătire pentru e-Factura viitor) |
| status | enum: `TRIAL`, `ACTIVE`, `SUSPENDED` | implicit `TRIAL` la înregistrare |
| createdAt | datetime | |

### User (utilizator)

| Câmp | Tip | Note |
|---|---|---|
| id | string (cuid) | |
| email | string, unic global | |
| passwordHash | string | bcrypt |
| name | string | |
| role | enum: `SUPER_ADMIN`, `COMPANY_ADMIN`, `COMPANY_USER` | |
| companyId | string, nullable | null doar pentru `SUPER_ADMIN` |
| jobTitle | string, opțional | etichetă liberă (ex: „Dispecer”, „Contabil”); fără logică de permisiuni asociată în acest modul |
| status | enum: `ACTIVE`, `INVITED`, `DISABLED` | |
| createdAt | datetime | |

### Invitation (invitație)

| Câmp | Tip | Note |
|---|---|---|
| id | string (cuid) | |
| email | string | |
| companyId | string | |
| role | enum: `COMPANY_ADMIN`, `COMPANY_USER` | Super Admin nu se invită |
| token | string, unic | |
| expiresAt | datetime | 7 zile de la creare |
| status | enum: `PENDING`, `ACCEPTED`, `EXPIRED` | |
| createdAt | datetime | |

## Multi-tenancy

Bază de date comună (shared database, shared schema). Fiecare tabel legat de
o firmă are coloana `companyId`. Toate interogările către date scoped la
firmă trec printr-un helper de acces la date care impune filtrarea după
`companyId`-ul din sesiunea curentă — nu există cale de a interoga date
company-scoped fără acest filtru. `SUPER_ADMIN` este singurul rol care poate
citi peste toate firmele, printr-un set de funcții separate, explicit
marcate ca „admin only”, folosite doar în paginile din `/admin`.

Acest invariant (izolare completă între firme) este cea mai importantă
proprietate de securitate a sistemului și rămâne valabil pentru toate
modulele viitoare care adaugă tabele noi.

## Fluxuri

### Înregistrare firmă (self-service)

1. Vizitator completează: nume firmă, CUI, nume complet, email, parolă
2. Se creează simultan: `Company` (status `TRIAL`) + `User` (role
   `COMPANY_ADMIN`, status `ACTIVE`, legat de firma nou creată)
3. Utilizatorul e logat automat și ajunge pe dashboard, cu un mesaj că
   firma e în așteptare de activare

### Activare firmă

1. `SUPER_ADMIN` vede în `/admin` lista firmelor cu status `TRIAL`
2. Poate schimba status-ul în `ACTIVE` sau `SUSPENDED` manual
3. Fără procesare de plăți în acest modul

### Login

1. Email + parolă → Auth.js validează
2. Dacă firma utilizatorului are status `SUSPENDED` → login respins, mesaj
   explicit
3. Dacă user status `DISABLED` → login respins, mesaj explicit
4. `SUPER_ADMIN` (companyId null) nu e afectat de status-ul vreunei firme

### Invitare utilizator (de către `COMPANY_ADMIN`)

1. Admin firmă introduce email + alege rol (`COMPANY_ADMIN` sau
   `COMPANY_USER`) + opțional jobTitle
2. Se creează `Invitation` cu token unic, se trimite email cu link
3. Link deschide pagină de setare parolă → la completare, se creează
   `User` (status `ACTIVE`) legat de firma din invitație, invitația trece
   `ACCEPTED`
4. Token expirat/deja folosit → mesaj clar, opțiune „cere retrimitere” către
   admin firmei (nu automatizat în acest modul)

## Pagini / rute

- `/inregistrare` — înregistrare firmă self-service
- `/login`
- `/dashboard` — shell gol, comun pentru `COMPANY_ADMIN`/`COMPANY_USER` (bază pentru modulele viitoare)
- `/dashboard/echipa` — Admin firmă: listă utilizatori firmă, invitare, dezactivare
- `/invitatie/[token]` — acceptare invitație, setare parolă
- `/admin` — Super Admin: listă firme, activare/suspendare
- `/admin/firme/[id]` — detalii firmă, listă utilizatori

## Gestionare erori & cazuri speciale

- Firmă suspendată → blocaj la login cu mesaj explicit, nu doar UI ascuns
- Token invitație expirat/folosit → mesaj clar + cale de recuperare
- Email deja înregistrat (global) → mesaj clar la înregistrare/invitare
- Acces la resurse din altă firmă (inclusiv prin URL manual) → verificat și
  blocat la nivel de server (nu doar ascuns în interfață), returnează 404
  (nu 403, ca să nu confirme existența resursei către o firmă neautorizată)

## Testare

- Teste automate țintite pe invariantul critic: izolarea între firme
  (un user din firma A nu poate citi/scrie date din firma B, inclusiv prin
  acces direct la ID-uri)
- Testare manuală ghidată (checklist) pentru fluxurile complete: înregistrare
  firmă A și B, verificare izolare, activare/suspendare din `/admin`,
  invitare utilizator, acceptare invitație, login blocat pe firmă suspendată

## În afara scopului acestui modul

- Plăți/facturare abonament (Stripe sau similar)
- Roluri interne cu permisiuni granulare pe funcționalitate (doar etichetă
  `jobTitle` liberă, fără logică asociată)
- Resetare parolă prin email (adăugată imediat după acest modul)
- Pagină publică de marketing/landing
- e-Factura, GPS live, tahograf, portal client — module ulterioare beta
