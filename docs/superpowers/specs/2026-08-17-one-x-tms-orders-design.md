# ONE x TMS — Modulul 2: Clienți & Comenzi de transport

## Context

Al doilea modul din ONE x TMS (după Fundamentul SaaS: autentificare, multi-tenancy,
administrare firme). Aduce inima operațională a aplicației: evidența clienților și
comenzile de transport primite de la ei.

Se construiește peste fundația existentă: Next.js 15 (App Router), PostgreSQL prin
Prisma 7, Auth.js v5, Tailwind + shadcn/ui, deploy automat pe Vercel. Toate datele
noi sunt scoped la firmă și trec prin `assertCompanyAccess` din `lib/tenancy.ts`.

Interfața folosește scheletul existent (`AppShell`, `PageHeader`, tabele). Designul
vizual propriu-zis rămâne programat după Modulul 4, conform deciziei din roadmap.

### Livrare în două etape

Un singur modul, dar planul de implementare îl împarte în două părți verificabile
separat:

- **Etapa A — Clienți**: model, acces la date, ecrane. Livrabil funcțional de sine
  stătător.
- **Etapa B — Comenzi**: model, numerotare, valută, stări, opriri, ecrane. Depinde
  de Etapa A.

## Scopul acestui modul

Un transportator trebuie să poată: ține evidența firmelor care îi dau comenzi,
înregistra o comandă de transport cu traseul ei complet, urmări în ce stadiu se
află, și ști ce are de încasat și cât a câștigat pe fiecare comandă.

## Model de date

### Client (partener)

| Câmp | Tip | Note |
|---|---|---|
| id | String (cuid) | |
| companyId | String | tenant — obligatoriu pe toate interogările |
| name | String | denumire firmă |
| cui | String | cod fiscal |
| address | String | stradă/număr |
| city | String | |
| country | String | implicit `"România"` |
| contactName | String? | persoană de contact |
| contactPhone | String? | |
| contactEmail | String? | |
| paymentTermDays | Int | implicit `45`; se copiază pe comandă la creare |
| isActive | Boolean | implicit `true`; `false` = ascuns la comenzi noi |
| notes | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Index: `(companyId, name)` pentru căutare. Nu există constrângere de unicitate pe
`cui` — același CUI poate apărea legitim la firme diferite de pe platformă, iar în
interiorul unei firme duplicatele se semnalează, nu se blochează (vezi Erori).

### Order (comandă de transport)

| Câmp | Tip | Note |
|---|---|---|
| id | String (cuid) | |
| companyId | String | tenant |
| year | Int | anul calendaristic al creării |
| sequence | Int | numărul secvențial în anul respectiv, pentru firma respectivă |
| orderNumber | String | `"2026-0001"` (an + secvență pe 4 cifre), compus și stocat la creare, pentru căutare directă |
| clientId | String | |
| clientReference | String | numărul comenzii la client |
| status | enum `OrderStatus` | implicit `NEW` |
| cargoDescription | String | |
| cargoWeightKg | Decimal(10,3)? | |
| cargoPackaging | String? | ex. „paleți", „vrac" |
| salePrice | Decimal(12,2) | prețul convenit cu clientul |
| currency | enum `Currency` | `RON` sau `EUR` |
| exchangeRate | Decimal(10,4) | cursul folosit; `1.0000` pentru RON |
| exchangeRateDate | Date | ziua cursului BNR aplicat |
| salePriceRon | Decimal(12,2) | `salePrice × exchangeRate`, înghețat la creare |
| estimatedCostRon | Decimal(12,2)? | cost estimat al cursei, în RON |
| paymentTermDays | Int | copiat de la client, editabil |
| documentsReceivedAt | DateTime? | când au sosit CMR-ul și documentele |
| notes | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Constrângere de unicitate: `(companyId, year, sequence)` și `(companyId, orderNumber)`.

**Marja nu se stochează.** Se calculează la afișare: `salePriceRon − estimatedCostRon`,
iar procentual `marjă / salePriceRon × 100`. Când `estimatedCostRon` lipsește, marja
se afișează ca „—", nu ca zero.

### OrderStop (oprire)

| Câmp | Tip | Note |
|---|---|---|
| id | String (cuid) | |
| orderId | String | |
| sequence | Int | poziția în traseu, începe de la 1 |
| type | enum `StopType` | `LOADING` / `UNLOADING` |
| locationName | String? | ex. „Depozit Ploiești" |
| address | String | |
| city | String | |
| country | String | implicit `"România"` |
| scheduledDate | Date | ziua programată |
| timeFrom | String? | interval orar, format `"HH:MM"` |
| timeTo | String? | format `"HH:MM"` |
| contactName | String? | persoana de la fața locului |
| contactPhone | String? | |
| notes | String? | |

Constrângere de unicitate: `(orderId, sequence)`. Opririle se șterg în cascadă
odată cu comanda (relevant doar dacă o comandă e ștearsă administrativ din baza de
date; interfața nu permite ștergerea).

### Enum-uri

```
OrderStatus: NEW, CONFIRMED, IN_PROGRESS, DELIVERED, DOCUMENTS_RECEIVED, INVOICED, CANCELLED
Currency:    RON, EUR
StopType:    LOADING, UNLOADING
```

Valorile enum rămân în engleză, ca la fundație (`CompanyStatus`, `UserRole`).
Interfața le afișează traduse: Nouă, Confirmată, În execuție, Livrată, Documente
primite, Facturată, Anulată; Încărcare / Descărcare.

## Numerotarea comenzilor

Format `AAAA-NNNN`, secvențial pe an și pe firmă: prima comandă din 2026 a firmei X
este `2026-0001`, indiferent ce numere are firma Y.

Generarea se face **în interiorul tranzacției de creare**, luând `MAX(sequence) + 1`
pentru `(companyId, year)` cu blocare la nivel de rând. Constrângerea de unicitate
pe `(companyId, year, sequence)` este plasa de siguranță: dacă două comenzi se
creează simultan și una pierde cursa, operația se reîncearcă o dată, apoi eșuează
cu mesaj clar. Fără această disciplină, două comenzi pot primi același număr —
motiv pentru care există test dedicat.

Secvența nu se reciclează: o comandă anulată își păstrează numărul pentru totdeauna.

## Valută și curs BNR

Prețul se introduce în valuta comenzii. Echivalentul în RON se calculează o singură
dată, la creare, și **nu se mai recalculează niciodată** — chiar dacă prețul se
editează ulterior, cursul rămâne cel de la data comenzii, doar `salePriceRon` se
recalculează cu acel curs.

- Pentru `RON`: `exchangeRate = 1.0000`, `exchangeRateDate` = data creării, fără
  apel extern.
- Pentru `EUR`: cursul se ia din fluxul public BNR
  (`https://curs.bnr.ro/nbrfxrates.xml`), gratuit și fără cheie de acces.
  Atenție: adresa veche `www.bnr.ro/nbrfxrates.xml` redirecționează acum către
  pagina principală și nu mai livrează XML-ul.

BNR publică doar în zilele lucrătoare. În weekend și de sărbători se folosește
ultimul curs publicat, iar `exchangeRateDate` reflectă ziua acelui curs, nu ziua
creării comenzii — exact cum se procedează contabil.

Cursul zilei se cache-uiește în memorie pe durata procesului, ca să nu se apeleze
BNR la fiecare comandă.

**Dacă BNR nu răspunde**, salvarea nu se blochează: formularul cere utilizatorului
să introducă manual cursul, cu un mesaj care explică de ce. Cursul introdus manual
se stochează identic — nu există distincție în date între curs automat și manual.

## Stări și tranziții permise

```
NEW ──────────────► CONFIRMED ──────► IN_PROGRESS ──────► DELIVERED
                                                              │
                                                              ▼
                                                    DOCUMENTS_RECEIVED
                                                              │
                                                              ▼
                                                          INVOICED
```

Din orice stare, în afară de `INVOICED` și `CANCELLED`, se poate trece în
`CANCELLED`. `INVOICED` și `CANCELLED` sunt stări finale: nu se mai iese din ele.

Tranzițiile se validează pe server, într-o funcție dedicată, nu doar prin ascunderea
butoanelor în interfață. Orice tranziție nepermisă returnează eroare explicită.

Trecerea în `DOCUMENTS_RECEIVED` completează automat `documentsReceivedAt` cu
momentul curent, dacă nu e deja setat.

## Pagini / rute

| Rută | Ce face |
|---|---|
| `/dashboard/clienti` | listă clienți, căutare după nume sau CUI, filtru activ/inactiv |
| `/dashboard/clienti/nou` | formular client nou |
| `/dashboard/clienti/[id]` | fișa clientului: date editabile + comenzile lui |
| `/dashboard/comenzi` | listă comenzi, filtru pe stare, căutare după număr propriu sau referința clientului |
| `/dashboard/comenzi/noua` | formular comandă nouă, inclusiv opririle |
| `/dashboard/comenzi/[id]` | fișa comenzii: date editabile, opriri, butoane de schimbare a stării |

Meniul lateral primește două intrări noi: **Comenzi** și **Clienți**, vizibile
pentru ambele roluri de firmă.

## Fluxuri

### Client nou

1. Formular: nume, CUI, adresă, oraș, țară, contact, termen de plată (implicit 45)
2. La salvare, dacă mai există un client cu același CUI în firmă, salvarea se
   oprește și formularul afișează numele clientului existent plus un buton
   „Adaugă oricum". Al doilea click retrimite aceleași date cu un indicator de
   confirmare a duplicatului, iar clientul se creează. Datele completate nu se
   pierd între cele două trimiteri.
3. Clientul apare imediat în lista de alegere la comenzi

### Comandă nouă

1. Se alege clientul dintre cei **activi**; `paymentTermDays` se completează automat
2. Se introduc: referința clientului, descrierea mărfii, greutatea, ambalajul
3. Se adaugă opririle — minim una de încărcare și una de descărcare, în ordinea
   dorită, cu posibilitatea de a adăuga oricâte
4. Se introduc prețul și valuta; la `EUR` se afișează cursul preluat și echivalentul
   în RON, înainte de salvare
5. Opțional, costul estimat în RON
6. Comanda se salvează cu status `NEW` și primește numărul următor din secvență

### Schimbarea stării

Din fișa comenzii, butoane pentru stările permise din starea curentă. Fiecare
schimbare validată pe server.

### Anulare

Buton distinct, cu confirmare. Comanda rămâne în listă, marcată `ANULATĂ`, exclusă
din totalurile financiare.

## Reguli de business

1. **Comenzile nu se șterg, doar se anulează.** Nu există ștergere în interfață.
2. **Clienții nu se șterg, doar se dezactivează** (`isActive = false`). Un client
   inactiv nu apare la comenzi noi, dar comenzile lui istorice rămân intacte și
   fișa lui rămâne accesibilă.
3. **Fără drepturi diferite pe rol în acest modul.** `COMPANY_ADMIN` și
   `COMPANY_USER` au aceleași drepturi asupra clienților și comenzilor, consecvent
   cu decizia din fundație ca rolurile să fie doar etichete. `SUPER_ADMIN` nu are
   acces la datele operaționale ale firmelor prin aceste ecrane.

## Gestionare erori & cazuri speciale

- **Client duplicat după CUI** → avertisment cu confirmare, nu blocare
- **Comandă fără cel puțin o încărcare și o descărcare** → eroare de validare la
  salvare, cu mesaj explicit
- **BNR indisponibil** → cerere de introducere manuală a cursului, cu explicație
- **Coliziune la numerotare** → o reîncercare automată, apoi eroare clară
- **Tranziție de stare nepermisă** → respinsă pe server, mesaj explicit
- **Client inactiv folosit la o comandă nouă** → respins pe server (nu doar ascuns
  în listă)
- **Acces la un client sau o comandă din altă firmă**, inclusiv prin adresă
  scrisă manual → 404, ca la fundație, ca să nu confirme existența resursei

## Testare

Teste automate, prioritizate pe ce provoacă daune reale:

- **Izolarea între firme**, extinsă la `Client`, `Order`, `OrderStop`: un
  utilizator din firma A nu poate citi sau modifica date ale firmei B, inclusiv
  prin acces direct la ID-uri
- **Numerotarea**: secvențială pe firmă și an; două creări simultane nu produc
  același număr; anularea nu reciclează numărul
- **Valuta**: `salePriceRon` calculat corect; cursul rămâne înghețat la editarea
  ulterioară a prețului; `RON` nu apelează BNR
- **Tranzițiile de stare**: cele permise trec, cele nepermise sunt respinse;
  `INVOICED` și `CANCELLED` sunt finale
- **Opririle**: validarea „minim o încărcare și o descărcare"; ordinea se păstrează
- **Clienții inactivi**: respinși la comenzi noi

Testare manuală ghidată, end-to-end: client nou → comandă cu trei opriri → parcurs
complet al stărilor → verificare din a doua firmă că nu vede nimic.

## În afara scopului acestui modul

- Alocarea vehiculului și a șoferului — Modulele 3-4 (Flotă, Dispecerat)
- Emiterea facturii și e-Factura/ANAF — Modulul 5; aici `INVOICED` este bifă manuală
- Încărcarea documentelor scanate (CMR) — aplicația de șofer, post-beta
- Starea individuală a fiecărei opriri — Modulul 6 (Tracking)
- Descompunerea costurilor pe categorii (motorină, taxe de drum, salarii) — un
  singur cost estimat, introdus manual
- Drepturi granulare pe rol
- Rapoarte și agregări financiare — Modulul 7; aici doar marja per comandă
- Design vizual propriu — programat după Modulul 4
