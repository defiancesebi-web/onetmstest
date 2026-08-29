import Link from "next/link";
import {
  Truck,
  Send,
  ChevronLeft,
  ChevronRight,
  Package,
  MapPin,
  Container,
} from "lucide-react";
import { auth } from "@/auth";
import { getDispatchBoard, type DispatchView } from "@/lib/data/dispatch";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { TripStatusBadge } from "@/components/trip-status-badge";

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

const VIEWS: DispatchView[] = ["drivers", "trucks", "trailers"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function DispeceratPage({
  searchParams,
}: {
  searchParams: Promise<{ vedere?: string; sapt?: string }>;
}) {
  const { vedere, sapt } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.dispatch;
  const intlLocale = locale === "ro" ? "ro-RO" : "en-US";

  const view: DispatchView = VIEWS.includes(vedere as DispatchView)
    ? (vedere as DispatchView)
    : "drivers";

  // Monday of the visible week: from ?sapt=YYYY-MM-DD if valid, else this week.
  const validSapt = sapt && /^\d{4}-\d{2}-\d{2}$/.test(sapt);
  let monday: Date;
  if (validSapt) {
    monday = new Date(`${sapt}T00:00:00`);
  } else {
    const nowBuc = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
    const dow = (nowBuc.getDay() + 6) % 7; // 0 = Monday
    monday = new Date(nowBuc);
    monday.setDate(nowBuc.getDate() - dow);
  }
  monday.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
  const weekKeys = weekDays.map(keyOf);
  const weekStart = weekKeys[0];
  const weekEnd = weekKeys[6];
  const todayKey = bucharestKey(new Date());
  const todayIdx = weekKeys.indexOf(todayKey);

  const board = await getDispatchBoard(sessionUser, companyId, { view, weekStart, weekEnd });

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const hrefWeek = (mon: Date | null) =>
    `/dashboard/dispecerat?vedere=${view}${mon ? `&sapt=${keyOf(mon)}` : ""}`;
  const hrefView = (v: DispatchView) =>
    `/dashboard/dispecerat?vedere=${v}${validSapt ? `&sapt=${sapt}` : ""}`;

  const monthLabel = weekDays[3].toLocaleDateString(intlLocale, { month: "long", year: "numeric" });
  const rangeLabel = `${weekDays[0].toLocaleDateString(intlLocale, { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString(intlLocale, { day: "numeric", month: "short", year: "numeric" })}`;
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });

  // Column span (1-based grid columns) for a card inside the visible week.
  function span(startKey: string, endKey: string): { start: number; end: number } | null {
    if (endKey < weekStart || startKey > weekEnd) return null;
    const s = startKey <= weekStart ? 0 : weekKeys.indexOf(startKey);
    const e = endKey >= weekEnd ? 6 : weekKeys.indexOf(endKey);
    return { start: (s < 0 ? 0 : s) + 1, end: (e < 0 ? 6 : e) + 2 };
  }

  const cardsByRow = new Map<string, typeof board.cards>();
  for (const c of board.cards) {
    if (!span(c.startKey, c.endKey)) continue;
    if (!cardsByRow.has(c.rowKey)) cardsByRow.set(c.rowKey, []);
    cardsByRow.get(c.rowKey)!.push(c);
  }

  const noneLabel =
    view === "drivers" ? d.noDriver : view === "trucks" ? d.noTruck : d.noTrailer;
  const rowLabel = (row: { key: string; label: string }) =>
    row.key === "__none__" ? noneLabel : row.label;

  const tabLabel = (v: DispatchView) =>
    v === "drivers" ? d.tabDrivers : v === "trucks" ? d.tabTrucks : d.tabTrailers;

  return (
    <div className="space-y-4">
      {/* Header row: month + week nav + send dispatch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold capitalize tracking-tight">{monthLabel}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title={locale === "ro" ? "Disponibil în curând" : "Coming soon"}
            className="bg-primary/60 text-primary-foreground inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold"
          >
            <Send className="size-4" />
            {d.sendDispatch}
          </button>
          <div className="bg-card flex items-center gap-1 rounded-lg border p-0.5">
            <Link
              href={hrefWeek(prevMonday)}
              className="hover:bg-muted grid size-8 place-items-center rounded-md"
              aria-label="◀"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <Link
              href={hrefWeek(null)}
              className="hover:bg-muted rounded-md px-3 py-1.5 text-[13px] font-semibold"
            >
              {d.today}
            </Link>
            <Link
              href={hrefWeek(nextMonday)}
              className="hover:bg-muted grid size-8 place-items-center rounded-md"
              aria-label="▶"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <span className="bg-card text-muted-foreground rounded-lg border px-3 py-1.5 text-[13px] font-medium">
            {rangeLabel}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={hrefView(v)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ${
              v === view
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {tabLabel(v)}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Unassigned loads */}
        <aside className="bg-card shrink-0 rounded-xl border shadow-sm lg:w-[248px]">
          <div className="border-b px-4 py-3">
            <h2 className="text-[11px] font-bold tracking-[0.06em] uppercase">
              {d.unassignedLoads}{" "}
              <span className="text-muted-foreground">({board.unassigned.length})</span>
            </h2>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
            {board.unassigned.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
                {d.noUnplanned}
              </p>
            ) : (
              board.unassigned.map((o) => (
                <Link
                  key={o.id}
                  href={`/dashboard/curse/noua?comanda=${o.id}`}
                  className="hover:border-primary/50 block rounded-lg border p-2.5 text-sm transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-primary inline-flex items-center gap-1.5 font-semibold">
                      <Package className="size-3.5" />
                      {o.orderNumber}
                    </span>
                    <TripStatusBadge status="PLANNED" locale={locale} />
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">{o.clientName}</p>
                  {(o.originCity || o.destCity) && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {o.originCity ?? "—"} → {o.destCity ?? "—"}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>
        </aside>

        {/* Calendar board */}
        <section className="bg-card min-w-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
          <div className="overflow-x-auto">
            <div className="relative min-w-[760px]">
              {/* now line */}
              {todayIdx >= 0 && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-rose-500"
                  style={{ left: `calc(168px + (100% - 168px) * ${(todayIdx + 0.5) / 7})` }}
                >
                  <span className="absolute -top-0.5 -left-1 size-2 rounded-full bg-rose-500" />
                </div>
              )}

              {/* Header: corner + day columns */}
              <div className="grid grid-cols-[168px_1fr] border-b">
                <div className="text-muted-foreground px-4 py-2.5 text-[11px] font-bold tracking-[0.06em] uppercase">
                  {tabLabel(view)}
                </div>
                <div className="grid grid-cols-7">
                  {weekDays.map((dd) => {
                    const isToday = keyOf(dd) === todayKey;
                    return (
                      <div
                        key={keyOf(dd)}
                        className={`border-l px-2 py-2 text-center text-xs ${isToday ? "bg-primary/5" : ""}`}
                      >
                        <div className="text-muted-foreground uppercase">{weekdayFmt.format(dd)}</div>
                        <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                          {dd.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows */}
              {board.rows.length === 0 ? (
                <p className="text-muted-foreground p-8 text-center text-sm">{d.noTrips}</p>
              ) : (
                board.rows.map((row) => {
                  const rowCards = cardsByRow.get(row.key) ?? [];
                  return (
                    <div
                      key={row.key}
                      className="grid min-h-[64px] grid-cols-[168px_1fr] border-b last:border-0"
                    >
                      {/* Row label */}
                      <div className="flex items-center gap-2.5 px-3 py-2">
                        {view === "drivers" ? (
                          <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold">
                            {row.key === "__none__" ? "—" : initials(row.label)}
                          </span>
                        ) : (
                          <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg">
                            {view === "trailers" ? (
                              <Container className="size-4" />
                            ) : (
                              <Truck className="size-4" />
                            )}
                          </span>
                        )}
                        <span className="min-w-0 truncate text-[13px] font-medium">
                          {rowLabel(row)}
                        </span>
                      </div>

                      {/* Day cells + cards */}
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
                          {weekKeys.map((k) => (
                            <div key={k} className={`border-l ${k === todayKey ? "bg-primary/5" : ""}`} />
                          ))}
                        </div>
                        <div className="relative space-y-1 py-1.5">
                          {rowCards.length === 0 && <div className="h-7" />}
                          {rowCards.map((c) => {
                            const s = span(c.startKey, c.endKey)!;
                            return (
                              <div key={c.id} className="grid grid-cols-7 px-1">
                                <Link
                                  href={`/dashboard/curse/${c.id}`}
                                  style={{ gridColumn: `${s.start} / ${s.end}` }}
                                  className="bg-card hover:border-primary/60 min-w-0 rounded-md border px-2 py-1.5 shadow-sm transition-colors"
                                  title={`${c.tripNumber}`}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="truncate text-xs font-semibold">
                                      {c.tripNumber}
                                    </span>
                                    <TripStatusBadge status={c.status} locale={locale} />
                                  </div>
                                  {(c.originCity || c.destCity) && (
                                    <div className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-[11px]">
                                      <MapPin className="size-3 shrink-0" />
                                      <span className="truncate">
                                        {c.originCity ?? "—"} → {c.destCity ?? "—"}
                                      </span>
                                    </div>
                                  )}
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
