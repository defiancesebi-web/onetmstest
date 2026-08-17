# ONE x TMS — Modulul 3: Flotă & Șoferi

## Context

Al treilea modul din ONE x TMS, după Fundamentul SaaS (autentificare,
multi-tenancy) și Clienți & Comenzi. Aduce evidența vehiculelor și a șoferilor,
împreună cu documentele lor și avertizarea la expirare.

Se construiește peste stiva existentă: Next.js 16 (App Router), PostgreSQL prin
Prisma 7, Auth.js v5, Tailwind + shadcn/ui, deploy automat pe Vercel. Toate
datele noi sunt scoped la firmă și trec prin `assertCompanyAccess` din
`lib/tenancy.ts`. Interfața folosește scheletul existent (`AppShell`,
`PageHeader`, tabele); designul vizual propriu rămâne programat după Modulul 4.

### De ce costurile nu sunt în acest modul

Scopul urmărit era marja reală pe comandă, nu doar cheltuiala lunară pe vehicul.
Marja reală cere să se știe **ce camion a executat ce comandă**, iar acea
legătură se naște abia în Modulul 4 (Dispecerat). Costurile construite acum ar
produce „camionul X a costat 12.000 lei luna trecută" — util, dar nu ce se
căuta. Ordinea devine: Flotă & Șoferi (acest modul) → Dispecerat → Costuri și
marjă reală.

## Scopul acestui modul

Un transportator trebuie să știe ce vehicule și ce șoferi are, ce documente au
fiecare, și **când expiră** — din timp, nu când îl oprește poliția. Un ITP sau
un atestat expirat înseamnă amendă, camion imobilizat și cursă pierdută.

## Model de date

### Vehicle (vehicul)

| Câmp | Tip | Note |
|---|---|---|
| id | String (cuid) | |
| companyId | String | tenant — obligatoriu pe toate interogările |
| registrationNumber | String | număr de înmatriculare |
| type | enum `VehicleType` | `TRACTOR_UNIT`, `SEMI_TRAILER`, `RIGID_TRUCK`, `VAN_3_5T` |
| make | String? | marca |
| model | String? | |
| manufactureYear | Int? | |
| vin | String? | serie de șasiu |
| isActive | Boolean | implicit `true`; `false` = vândut/scos din uz |
| notes | String? | |
| createdAt / updatedAt | DateTime | |

Constrângere de unicitate: `(companyId, registrationNumber)` — același număr nu
poate apărea de două ori în aceeași firmă, dar două firme diferite pot avea
(teoretic) evidențe independente.

Index: `(companyId, isActive)` pentru listare.

Capul tractor și semiremorca sunt **înregistrări separate**, fiecare cu
documentele ei, pentru că fiecare are ITP și RCA proprii și remorcile se mută
între capete tractoare. `RIGID_TRUCK` acoperă camioanele fără remorcă,
`VAN_3_5T` dubele de 3,5 tone.

Duba nu este un caz special în model: are aceleași câmpuri și acceptă aceleași
tipuri de documente ca restul flotei. Distincția contează la afișare și, mai
târziu, la alocare în Dispecerat — o dubă și un cap tractor nu se potrivesc
acelorași comenzi.

### Driver (șofer)

| Câmp | Tip | Note |
|---|---|---|
| id | String (cuid) | |
| companyId | String | tenant |
| firstName | String | |
| lastName | String | |
| phone | String? | |
| email | String? | |
| personalId | String? | CNP — opțional intenționat (vezi mai jos) |
| hiredAt | DateTime? @db.Date | data angajării |
| isActive | Boolean | implicit `true` |
| notes | String? | |
| createdAt / updatedAt | DateTime | |

Index: `(companyId, lastName)`.

**Despre CNP**: rămâne opțional. Este necesar pentru contracte, dar este dată
personală — cu cât se păstrează mai puțin, cu atât e mai puțin de protejat. Nu
se afișează în liste, doar pe fișa șoferului.

Șoferul **nu** este legat de un cont `User` în acest modul. Legătura apare când
se construiește aplicația de șofer (post-beta), care are nevoie de autentificare
proprie.

### Document

| Câmp | Tip | Note |
|---|---|---|
| id | String (cuid) | |
| companyId | String | tenant — vezi nota de mai jos |
| vehicleId | String? | exact unul dintre `vehicleId` / `driverId` este completat |
| driverId | String? | |
| type | enum `DocumentType` | vezi lista |
| number | String? | seria/numărul documentului |
| issuedAt | DateTime? @db.Date | |
| expiresAt | DateTime @db.Date | obligatoriu — este rostul modulului |
| notes | String? | |
| createdAt / updatedAt | DateTime | |

Index: `(companyId, expiresAt)` — interogarea de alerte sortează exact după
aceste două coloane.

**Document poartă `companyId` direct**, spre deosebire de `OrderStop` din
Modulul 2, care nu-l poartă. Regula este aceeași în ambele cazuri și produce
rezultate diferite pentru că folosirea diferă: la opriri se ajunge numai prin
comandă, deci filtrarea comenzii le acoperă; documentele sunt interogate
**direct** de alertă, fără a trece prin vehicul sau șofer, deci au nevoie de
propria cheie de tenant.

**Exact un proprietar**: aplicația impune ca fiecare document să aibă completat
fie `vehicleId`, fie `driverId`, niciodată ambele și niciodată niciunul.
Validarea se face în stratul de acces la date, iar testele o acoperă.

### Enum-uri

```
VehicleType: TRACTOR_UNIT, SEMI_TRAILER, RIGID_TRUCK, VAN_3_5T

DocumentType (vehicule): ITP, RCA, CASCO, ROVINIETA, TAHOGRAF,
                         COPIE_CONFORMA, ASIGURARE_CMR
DocumentType (șoferi):   PERMIS_CONDUCERE, ATESTAT_PROFESIONAL,
                         CARD_TAHOGRAF, AVIZ_MEDICAL, AVIZ_PSIHOLOGIC
```

`DocumentType` este un singur enum; separarea pe vehicule și șoferi de mai sus
este ghidaj pentru interfață, care oferă la alegere doar tipurile potrivite
proprietarului. Nu se impune la nivel de bază de date — o firmă care ține un
document neobișnuit pe alt tip de proprietar nu strică nimic.

**Valorile `DocumentType` rămân în română**, spre deosebire de convenția din
restul aplicației (`NEW`, `CONFIRMED`, `ACTIVE`). Sunt denumiri din legislația
românească — ITP, RCA, rovinietă, copie conformă — fără echivalent englezesc
real; traducerea ar pierde sensul. `VehicleType` rămâne în engleză, fiind
noțiuni generice.

## Starea documentelor și alertele

Pentru fiecare document se calculează o stare, raportată la ziua curentă în
fusul orar **Europe/Bucharest** (aceeași regulă ca la numerotarea comenzilor —
serverul rulează pe UTC):

| Stare | Condiție |
|---|---|
| `EXPIRED` | `expiresAt` < azi |
| `EXPIRING_SOON` | `expiresAt` între azi și azi + 30 de zile, inclusiv ambele capete |
| `VALID` | `expiresAt` > azi + 30 de zile |

Un document care expiră **azi** este `EXPIRING_SOON`, nu `EXPIRED` — este încă
valabil în ziua respectivă.

Pragul de 30 de zile este o constantă în cod, nu o setare. Dacă se dovedește
greșit în uz, devine configurabil atunci.

**Alertele exclud vehiculele și șoferii inactivi.** Un camion vândut nu trebuie
să genereze avertizări pentru ITP-ul lui expirat.

**Pe dashboard** apare secțiunea „Documente care expiră": întâi cele expirate,
apoi cele care expiră curând, fiecare grup sortat crescător după dată. Fiecare
rând identifică proprietarul (număr de înmatriculare sau nume șofer), tipul
documentului și data. Când nu există nimic de semnalat, se afișează un mesaj
că totul este în regulă, nu o listă goală.

**În listele de vehicule și șoferi**, fiecare rând arată starea agregată a
documentelor sale: cea mai gravă stare dintre documentele lui (expirat >
expiră curând > în regulă). Un proprietar fără documente înregistrate se
afișează distinct — nu este „în regulă", ci „fără documente".

Starea agregată se calculează și se afișează **și pentru inactivi**, când sunt
vizibili prin filtru. Excluderea inactivilor se aplică numai alertelor de pe
dashboard: pe fișa unui camion vândut este util să se vadă cum stăteau
documentele lui, dar nu trebuie să te bată la cap zilnic pe pagina principală.

## Pagini / rute

| Rută | Ce face |
|---|---|
| `/dashboard/flota` | listă vehicule, căutare după număr, filtru activ/inactiv, stare documente |
| `/dashboard/flota/nou` | formular vehicul nou |
| `/dashboard/flota/[id]` | fișa vehiculului: date editabile + documentele lui |
| `/dashboard/soferi` | listă șoferi, căutare după nume, filtru activ/inactiv, stare documente |
| `/dashboard/soferi/nou` | formular șofer nou |
| `/dashboard/soferi/[id]` | fișa șoferului: date editabile + documentele lui |

Meniul lateral primește **Flotă** și **Șoferi**, vizibile pentru ambele roluri
de firmă. Documentele nu au pagini proprii — se administrează de pe fișa
proprietarului.

## Fluxuri

### Vehicul sau șofer nou

Formular, salvare, apare imediat în listă cu starea „fără documente".

### Adăugarea unui document

De pe fișa proprietarului: se alege tipul (lista oferă doar tipurile potrivite),
se completează numărul, data emiterii și **data expirării**, care este
obligatorie. Documentul apare în listă cu starea calculată.

### Reînnoirea

Se modifică data de expirare pe documentul existent. Nu se păstrează istoricul
documentelor expirate — nu s-a identificat o nevoie reală, iar dacă apare, se
adaugă atunci.

### Ștergerea

Documentele **se pot șterge**, spre deosebire de comenzi. O comandă ștearsă
lasă o gaură în evidența contabilă; un document introdus greșit este o eroare de
tastare. Vehiculele și șoferii **nu se șterg**, se dezactivează, ca istoricul să
rămână coerent.

## Reguli de business

1. **Vehiculele și șoferii nu se șterg, se dezactivează** (`isActive = false`).
   Inactivii nu apar în alerte și nu vor fi ofertați la alocare în Modulul 4,
   dar fișele lor rămân accesibile.
2. **Documentele se pot șterge și edita liber.**
3. **Fără drepturi diferite pe rol**, consecvent cu modulele anterioare:
   `COMPANY_ADMIN` și `COMPANY_USER` au aceleași drepturi. `SUPER_ADMIN` nu are
   acces la datele operaționale ale firmelor.

## Gestionare erori & cazuri speciale

- **Număr de înmatriculare duplicat în aceeași firmă** → respins cu mesaj
  explicit (spre deosebire de CUI-ul clienților, aici duplicatul este
  întotdeauna o greșeală)
- **Document fără proprietar, sau cu ambii** → respins în stratul de date
- **Dată de expirare lipsă** → respinsă la validare
- **Dezactivarea unui vehicul cu documente expirate** → permisă, documentele
  rămân, doar alertele tac
- **Acces la un vehicul, șofer sau document din altă firmă**, inclusiv prin
  adresă scrisă manual → 404, ca în restul aplicației

## Testare

Teste automate, prioritizate pe ce provoacă daune reale:

- **Izolarea între firme** pentru `Vehicle`, `Driver` și `Document`, cu atenție
  specială la interogarea de alerte, care atinge `Document` direct
- **Calculul stării**, inclusiv limitele: expiră azi, expiră exact peste 30 de
  zile, a expirat ieri
- **Excluderea inactivilor** din alerte
- **Un document are exact un proprietar** — nici zero, nici doi
- **Sortarea alertelor**: expirate înaintea celor apropiate, fiecare grup
  crescător după dată
- **Starea agregată** pe vehicul/șofer alege cea mai gravă stare, iar absența
  documentelor se distinge de „în regulă"
- **Numărul de înmatriculare duplicat** este respins în aceeași firmă și permis
  între firme diferite

Testare manuală ghidată: vehicul cu ITP expirat și șofer cu permis expirând în
10 zile → verificare pe dashboard → dezactivare vehicul → confirmare că dispare
din alerte.

## În afara scopului acestui modul

- Costuri pe vehicul (motorină, taxe de drum, reparații) — după Modulul 4
- Alocarea vehiculului și șoferului pe comandă — Modulul 4 (Dispecerat)
- Scanuri ale documentelor — aplicația de șofer, post-beta
- Alerte pe email — necesită domeniu verificat în Resend, care lipsește
- Istoricul documentelor expirate
- Prag de alertă configurabil
- Consum, date de tahograf, telematică, planificare revizii
- Legarea șoferului de un cont de utilizator — odată cu aplicația de șofer
- Design vizual propriu — programat după Modulul 4
