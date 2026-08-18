# ONE x TMS — Modulul 4: Dispecerat

## Context

Al patrulea modul din ONE x TMS, după Fundamentul SaaS, Clienți & Comenzi, și
Flotă & Șoferi. Leagă comenzile de flotă: cine duce ce, cu ce camion, când.

Se construiește peste stiva existentă: Next.js 16 (App Router), PostgreSQL prin
Prisma 7, Auth.js v5, Tailwind + shadcn/ui, deploy automat pe Vercel. Toate
datele noi sunt scoped la firmă și trec prin `assertCompanyAccess` din
`lib/tenancy.ts`.

### De ce acest modul deblochează costurile

Marja reală pe comandă cere să se știe **ce camion a executat ce comandă** —
legătura pe care o creează acest modul. Costurile reale (motorină, taxe de drum,
salarii) sunt modulul următor, și abia atunci se pune problema împărțirii
cheltuielilor unei curse între comenzile ei.

## Scopul acestui modul

Un dispecer trebuie să vadă ce comenzi așteaptă un camion, să formeze curse, să
aloce cap tractor, semiremorcă și șoferi, și să fie avertizat când alocă o
resursă deja ocupată.

## Model de date

### Trip (cursă)

| Câmp | Tip | Note |
|---|---|---|
| id | String (cuid) | |
| companyId | String | tenant |
| year | Int | anul calendaristic al creării |
| sequence | Int | secvențial în an, pentru firma respectivă |
| tripNumber | String | `"C-2026-0001"` — compus și stocat la creare |
| tractorUnitId | String? | capul tractor sau autocamionul/duba |
| trailerId | String? | semiremorca; gol pentru vehicule fără remorcă |
| primaryDriverId | String? | |
| secondDriverId | String? | echipaj pe curse lungi |
| startsAt | DateTime @db.Date | |
| endsAt | DateTime @db.Date | |
| datesEditedManually | Boolean | implicit `false`; vezi mai jos |
| status | enum `TripStatus` | implicit `PLANNED` |
| notes | String? | |
| createdAt / updatedAt | DateTime | |

Constrângeri de unicitate: `(companyId, year, sequence)` și
`(companyId, tripNumber)`. Index: `(companyId, status)` și
`(companyId, startsAt)`.

Toate cele patru resurse sunt **opționale**: o cursă poate exista înainte de a
i se aloca ceva. Formarea cursei și alocarea sunt momente diferite în practică —
un dispecer rezervă întâi camionul pe care mizează, apoi îi atașează marfa.

Numerotarea folosește **prefixul `C-`** ca să nu poată fi confundată vizual cu
numărul unei comenzi (`2026-0001`), care are exact aceeași formă.

### Legătura comandă–cursă

Se adaugă pe `Order` câmpul `tripId String?`, cu relație către `Trip`.

O comandă aparține **cel mult unei curse**; o cursă poate purta **oricâte**
comenzi. Cazul obișnuit este o comandă pe cursă; grupajul — mai multe încărcări
de la clienți diferiți pe același camion — este cazul pe care structura trebuie
să-l suporte, chiar dacă apare mai rar.

Index nou pe `Order`: `(companyId, tripId)`.

### Enum

```
TripStatus: PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
```

Valorile rămân în engleză, ca la `OrderStatus`. Interfața le afișează:
Planificată, În execuție, Încheiată, Anulată.

## Intervalul cursei

`startsAt` și `endsAt` se propun automat din opririle comenzilor atașate: de la
cea mai devreme `scheduledDate` a unei încărcări până la cea mai târzie a unei
descărcări.

**Recalcularea se face la fiecare atașare sau detașare de comandă, dar numai
cât timp `datesEditedManually` este `false`.** În momentul în care utilizatorul
editează intervalul, flagul devine `true` și recalcularea automată încetează
definitiv pentru acea cursă. Fără acest flag, adăugarea unei comenzi ar șterge
tăcut ziua de întoarcere adăugată manual — o pierdere invizibilă exact în datele
pe care se bazează detectarea suprapunerilor.

O cursă fără comenzi și fără interval editat păstrează intervalul cu care a fost
creată; dacă nu i s-a dat unul, `startsAt` și `endsAt` sunt ziua curentă în
`Europe/Bucharest`, ca peste tot în aplicație.

## Detectarea suprapunerilor

La alocarea unui cap tractor, a unei semiremorci sau a unui șofer, sistemul
caută alte curse ale aceleiași firme care folosesc aceeași resursă și al căror
interval se intersectează.

**Intervalele sunt inclusive la ambele capete.** O cursă care se termină pe 5 și
una care începe pe 5 **se suprapun**: un camion nu poate fi în două locuri în
aceeași zi. Formula: două intervale se suprapun când
`a.startsAt <= b.endsAt && b.startsAt <= a.endsAt`.

Cursele **anulate sunt ignorate** — nu ocupă resurse.

**Suprapunerea avertizează, nu blochează.** Utilizatorul vede ce cursă și ce
resursă intră în conflict, și poate continua. Motivul: în dispecerat planurile
se schimbă des, iar un sistem care refuză reprogramarea împinge oamenii înapoi
în Excel. Datele imperfecte pe care le vezi sunt mai utile decât datele perfecte
pe care nimeni nu le introduce.

Un al doilea șofer care este și șofer principal pe altă cursă suprapusă produce
același avertisment — ambele roluri ocupă persoana.

## Stări și propagare

```
PLANNED ──► IN_PROGRESS ──► COMPLETED
```

Din `PLANNED` și `IN_PROGRESS` se poate trece în `CANCELLED`. `COMPLETED` și
`CANCELLED` sunt stări finale.

**Propagarea către comenzi:**

| Tranziția cursei | Ce se întâmplă cu comenzile ei |
|---|---|
| → `IN_PROGRESS` | fiecare comandă în `CONFIRMED` trece în `IN_PROGRESS` |
| → `COMPLETED` | fiecare comandă în `IN_PROGRESS` trece în `DELIVERED` |
| → `CANCELLED` | comenzile se detașează, revin la lista neplanificate; statusul lor nu se schimbă |

Propagarea **sare peste comenzile care nu sunt în starea așteptată**. O comandă
deja `INVOICED` sau `CANCELLED` nu este trasă înapoi de încheierea unei curse.
Regula generală: propagarea poate doar avansa o comandă pe drumul ei firesc,
niciodată să o dea înapoi.

După `COMPLETED`, fiecare comandă merge mai departe singură — documente primite,
facturare — pentru că acele etape nu depind de camion.

## Pagini / rute

| Rută | Ce face |
|---|---|
| `/dashboard/dispecerat` | ecranul principal: comenzi neplanificate (stânga) și curse (dreapta), cu filtru pe stare |
| `/dashboard/curse/noua` | formular cursă nouă, opțional pornind de la o comandă |
| `/dashboard/curse/[id]` | fișa cursei: resurse editabile, comenzi atașate, traseu combinat, butoane de stare |

Meniul lateral primește **Dispecerat**, care duce la ecranul principal. Cursele
au rădăcina lor (`/dashboard/curse/...`) pentru că sunt lucruri de sine
stătătoare, la care se ajunge și din fișa unei comenzi, nu doar din ecranul de
planificare.

Fișa comenzii (`/dashboard/comenzi/[id]`) primește o secțiune care arată cursa
ei, cu link, sau un buton de planificare când nu are.

## Fluxuri

### Planificarea unei comenzi

Din lista de comenzi neplanificate: „Planifică" → fie atașare la o cursă
existentă (alegere dintr-o listă de curse `PLANNED` sau `IN_PROGRESS`), fie
creare de cursă nouă pornind de la acea comandă.

### Alocarea resurselor

Pe fișa cursei se aleg capul tractor, semiremorca și șoferii. Fiecare listă
oferă **doar înregistrări active**, filtrate pe tipul potrivit: la capul tractor
apar `TRACTOR_UNIT`, `RIGID_TRUCK` și `VAN_3_5T`; la semiremorcă doar
`SEMI_TRAILER`. Filtrarea este o comoditate a interfeței — serverul acceptă
orice vehicul activ al firmei, pentru că regulile reale au excepții pe care
acest modul nu le cunoaște.

La salvare, dacă apare o suprapunere, se afișează avertismentul cu cursa și
resursa în conflict, iar utilizatorul poate confirma.

### Atașarea și detașarea comenzilor

Se pot atașa doar comenzi `CONFIRMED` care nu au deja o cursă. Detașarea
readuce comanda în lista de neplanificate fără să-i schimbe starea.

**Atașarea și detașarea sunt permise numai cât cursa este `PLANNED` sau
`IN_PROGRESS`.** O cursă încheiată sau anulată este un fapt petrecut; a-i
schimba conținutul ar rescrie istoria pe care se va sprijini calculul de
costuri din modulul următor.

### Anularea

Cursa trece în `CANCELLED`, comenzile ei se detașează automat. Cursa rămâne
vizibilă în listă, marcată, cu numărul păstrat.

## Reguli de business

1. **Doar comenzile `CONFIRMED` pot fi planificate.** O comandă încă `NEW`,
   neconfirmată de client, nu are ce căuta pe un camion.
2. **Cursele nu se șterg, se anulează.** Numerele nu se reciclează.
3. **O comandă anulată se detașează automat** din cursa ei.
4. **Doar vehiculele și șoferii activi** sunt oferite la alocare; cursele
   istorice își păstrează resursele chiar dacă acestea au fost dezactivate
   ulterior.
5. **Fără drepturi diferite pe rol**, consecvent cu modulele anterioare.

## Gestionare erori & cazuri speciale

- **Comandă deja atașată altei curse** → respinsă cu mesaj explicit
- **Comandă care nu e `CONFIRMED`** → respinsă cu mesaj explicit
- **Resursă suprapusă** → avertisment cu detalii, confirmabil
- **Interval cu sfârșit înaintea începutului** → respins la validare
- **Tranziție de stare nepermisă** → respinsă pe server
- **Vehicul sau șofer dezactivat între timp** → cursa îl păstrează; la
  următoarea editare a cursei apare o notă că resursa este inactivă
- **Acces la o cursă din altă firmă**, inclusiv prin adresă scrisă manual → 404

## Testare

Teste automate, prioritizate pe ce provoacă daune reale:

- **Izolarea între firme** pentru `Trip` și pentru legătura comandă–cursă:
  nu se poate atașa o comandă a altei firme, nici cu o cursă a altei firme
- **Numerotarea curselor**: secvențială pe firmă și an, corectă sub creări
  simultane, fără reciclare după anulare
- **Detectarea suprapunerilor**, cu accent pe capete: curse care se ating într-o
  singură zi se consideră suprapuse; cursele anulate nu ocupă resurse; al doilea
  șofer contează la fel ca primul
- **Propagarea stărilor**: pornirea și încheierea mută comenzile în starea
  corectă, sar peste cele care nu sunt în starea așteptată, și nu dau înapoi o
  comandă facturată
- **Detașarea automată** a unei comenzi anulate
- **Recalcularea intervalului** la atașare și detașare, și oprirea recalculării
  după o editare manuală
- **Regula `CONFIRMED`**: o comandă `NEW` nu poate fi planificată

Testare manuală ghidată: două comenzi pe aceeași cursă → alocare camion și
șofer → încercarea aceluiași camion pe o cursă suprapusă → confirmarea
avertismentului → pornirea cursei și verificarea că ambele comenzi s-au mutat.

## În afara scopului acestui modul

- Costuri reale și marjă pe cursă — modulul următor
- Calendar/Gantt pe camioane — se evaluează la pasul de design vizual
- Optimizare de rute, calcul de kilometri, hărți
- Verificarea timpilor de condus și a datelor de tahograf
- Notificarea șoferului — aplicația de șofer, post-beta
- Alocare automată sau sugestii de camion
- Împărțirea cheltuielilor unei curse între comenzile ei — odată cu costurile
