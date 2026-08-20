import Link from "next/link";
import { Truck, CalendarRange } from "lucide-react";
import { auth } from "@/auth";
import { listTrips, listUnplannedOrders } from "@/lib/data/trips";
import { listVehicles } from "@/lib/data/vehicles";
import { TRIP_STATUS_LABELS } from "@/lib/tripStatus";
import type { TripStatus } from "@/lib/generated/prisma/enums";
import { buttonVariants } from "@/components/ui/button";

const BLOCK: Record<TripStatus, string> = {
  PLANNED: "bg-blue-100 border-blue-300 text-blue-800",
  IN_PROGRESS: "bg-amber-100 border-amber-300 text-amber-900",
  COMPLETED: "bg-emerald-100 border-emerald-300 text-emerald-800",
  CANCELLED: "bg-slate-100 border-slate-300 text-slate-500",
};

const DOT: Record<TripStatus, string> = {
  PLANNED: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-slate-400",
};

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A live instant → its Europe/Bucharest calendar-day key (YYYY-MM-DD). */
function bucharestKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function PlanningPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;

  const [trips, unplanned, vehicles] = await Promise.all([
    listTrips(sessionUser, companyId),
    listUnplannedOrders(sessionUser, companyId),
    listVehicles(sessionUser, companyId),
  ]);

  // Monday–Sunday of the current week, computed on Bucharest wall time.
  const nowBuc = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
  const dow = (nowBuc.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(nowBuc);
  monday.setDate(nowBuc.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const weekKeys = weekDays.map(keyOf);
  const weekStart = weekKeys[0];
  const weekEnd = weekKeys[6];
  const todayKey = bucharestKey(new Date());

  const weekdayFmt = new Intl.DateTimeFormat("ro-RO", { weekday: "short" });
  const rangeLabel = `${weekDays[0].toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}`;

  // Column span for a trip inside the visible week, or null if fully outside.
  function span(startsAt: Date, endsAt: Date): { start: number; end: number } | null {
    const s = bucharestKey(startsAt);
    const e = bucharestKey(endsAt);
    if (e < weekStart || s > weekEnd) return null;
    const startIdx = s <= weekStart ? 0 : weekKeys.indexOf(s);
    const endIdx = e >= weekEnd ? 6 : weekKeys.indexOf(e);
    return { start: (startIdx < 0 ? 0 : startIdx) + 1, end: (endIdx < 0 ? 6 : endIdx) + 2 };
  }

  // Truck rows: active pulling vehicles, plus a catch-all row for trips with no truck.
  const truckRows = vehicles
    .filter((v) => v.isActive && v.type !== "SEMI_TRAILER")
    .map((v) => ({ key: v.registrationNumber, label: v.registrationNumber }));
  const rows = [...truckRows, { key: "__none__", label: "Fără camion" }];

  const tripsByRow = new Map<string, typeof trips>();
  for (const t of trips) {
    const key = t.tractorUnit?.registrationNumber ?? "__none__";
    if (!tripsByRow.has(key)) tripsByRow.set(key, []);
    tripsByRow.get(key)!.push(t);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planificare</h1>
          <p className="text-muted-foreground text-sm">
            Cursele săptămânii, pe camioane. Comenzile neplanificate așteaptă în stânga.
          </p>
        </div>
        <span className="bg-card inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium">
          <CalendarRange className="text-muted-foreground size-4" /> {rangeLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(TRIP_STATUS_LABELS) as TripStatus[]).map((s) => (
          <span key={s} className="text-muted-foreground inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${DOT[s]}`} /> {TRIP_STATUS_LABELS[s]}
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Unassigned */}
        <section className="bg-card rounded-xl border p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            Neplanificate <span className="text-muted-foreground">({unplanned.length})</span>
          </h2>
          {unplanned.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
              Nicio comandă care să aștepte un camion.
            </p>
          ) : (
            <ul className="space-y-2">
              {unplanned.map((o) => {
                const a = o.stops[0];
                const b = o.stops[o.stops.length - 1];
                return (
                  <li key={o.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/dashboard/comenzi/${o.id}`} className="text-primary font-medium">
                        {o.orderNumber}
                      </Link>
                      <Link
                        href={`/dashboard/curse/noua?comanda=${o.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Planifică
                      </Link>
                    </div>
                    <p className="text-muted-foreground mt-1 truncate">{o.client.name}</p>
                    {a && b && (
                      <p className="text-muted-foreground truncate">
                        {a.city} → {b.city}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Timeline board */}
        <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {/* Header */}
              <div className="grid grid-cols-[150px_1fr] border-b">
                <div className="text-muted-foreground px-4 py-2.5 text-xs font-medium">Camion</div>
                <div className="grid grid-cols-7">
                  {weekDays.map((d) => {
                    const isToday = keyOf(d) === todayKey;
                    return (
                      <div
                        key={keyOf(d)}
                        className={`border-l px-2 py-2.5 text-center text-xs ${isToday ? "bg-primary/5 font-semibold" : "text-muted-foreground"}`}
                      >
                        <div className="capitalize">{weekdayFmt.format(d)}</div>
                        <div className={isToday ? "text-primary" : ""}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows */}
              {rows.map((row) => {
                const rowTrips = (tripsByRow.get(row.key) ?? []).filter((t) => span(t.startsAt, t.endsAt));
                return (
                  <div key={row.key} className="grid min-h-[56px] grid-cols-[150px_1fr] border-b last:border-0">
                    <div className="flex items-center gap-2 px-4 py-2 text-sm">
                      <Truck className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate font-medium">{row.label}</span>
                    </div>
                    <div className="relative">
                      {/* day grid lines */}
                      <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
                        {weekDays.map((d) => (
                          <div key={keyOf(d)} className={`border-l ${keyOf(d) === todayKey ? "bg-primary/5" : ""}`} />
                        ))}
                      </div>
                      {/* trip bars */}
                      <div className="relative space-y-1 py-1.5">
                        {rowTrips.length === 0 && <div className="h-6" />}
                        {rowTrips.map((t) => {
                          const s = span(t.startsAt, t.endsAt)!;
                          return (
                            <div key={t.id} className="grid grid-cols-7 px-1">
                              <Link
                                href={`/dashboard/curse/${t.id}`}
                                style={{ gridColumn: `${s.start} / ${s.end}` }}
                                className={`truncate rounded-md border px-2 py-1 text-xs font-medium ${BLOCK[t.status]}`}
                                title={`${t.tripNumber} · ${TRIP_STATUS_LABELS[t.status]}`}
                              >
                                {t.tripNumber}
                                {t.orders.length > 0 && (
                                  <span className="opacity-70"> · {t.orders.length} cmd.</span>
                                )}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <p className="text-muted-foreground text-xs">
        Alocarea prin tragere (drag &amp; drop) vine în pasul următor. Deocamdată, „Planifică" pe o comandă
        deschide formularul de cursă.
      </p>
    </div>
  );
}
