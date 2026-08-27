import Link from "next/link";
import { Truck, User, MapPin, Clock, Route, Satellite, Radio, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { getTrackingBoard, type TrackedTrip } from "@/lib/data/tracking";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";
import { StatCard } from "@/components/dashboard/stat-card";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { LiveFleetMap } from "@/components/dashboard/live-fleet-map";
import { buildFleetPositions } from "@/lib/geo/cities";

function formatDateKey(dateKey: string, locale: Locale) {
  // Bare "YYYY-MM-DD" — read back in UTC so a browser west of Bucharest keeps
  // the same calendar day (matches the order/trip pages' convention).
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

function RouteRow({
  trip,
  locale,
  t,
}: {
  trip: TrackedTrip;
  locale: Locale;
  t: Awaited<ReturnType<typeof getDictionary>>["tracking"];
}) {
  const onRoad = trip.status === "IN_PROGRESS";
  // First `doneStops` stops are the ones already passed (the list is date-sorted).
  const ticks = Array.from({ length: trip.totalStops }, (_, i) => ({
    left: trip.totalStops > 1 ? (i / (trip.totalStops - 1)) * 100 : 0,
    done: i < trip.doneStops,
  }));

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/curse/${trip.id}`}
            className="text-primary inline-flex items-center gap-1.5 font-semibold"
          >
            <Route className="size-4" />
            {trip.tripNumber}
          </Link>
          {trip.orderNumbers.length > 0 && (
            <p className="text-muted-foreground truncate text-xs">
              {trip.orderNumbers.join(" · ")}
            </p>
          )}
        </div>
        <TripStatusBadge status={trip.status} locale={locale} />
      </div>

      <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Truck className="size-3.5" />
          {trip.truck ?? t.noTruck}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <User className="size-3.5" />
          {trip.driver ?? t.noDriver}
        </span>
      </div>

      {/* Estimated progress track: origin → destination with a truck marker. */}
      <div className="mb-1 flex items-center justify-between text-xs font-medium">
        <span className="inline-flex items-center gap-1 truncate">
          <span className="size-2 rounded-full bg-emerald-500" />
          {trip.originCity ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1 truncate">
          {trip.destinationCity ?? "—"}
          <MapPin className="size-3.5 text-rose-500" />
        </span>
      </div>

      <div className="px-3 py-2">
        <div className="relative h-1.5 rounded-full bg-slate-200">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${onRoad ? "bg-primary" : "bg-slate-300"}`}
            style={{ width: `${trip.progressPct}%` }}
          />
          {ticks.map((tick, i) => (
            <span
              key={i}
              className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${
                tick.done ? "bg-primary" : "bg-slate-300"
              }`}
              style={{ left: `${tick.left}%` }}
            />
          ))}
          <span
            className={`absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow ring-2 ring-white ${
              onRoad ? "bg-primary" : "bg-slate-400"
            }`}
            style={{ left: `${trip.progressPct}%` }}
          >
            <Truck className="size-3.5" />
          </span>
        </div>
      </div>

      <div className="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
        <span>
          {trip.doneStops}/{trip.totalStops} {t.stopsWord}
        </span>
        {onRoad && (
          <span>
            {trip.progressPct}% · {t.estimated}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {trip.nextStop ? (
            <>
              {t.nextStopLabel}: <span className="text-foreground font-medium">{trip.nextStop.city}</span> ·{" "}
              {formatDateKey(trip.nextStop.dateKey, locale)}
            </>
          ) : (
            t.noNextStop
          )}
        </span>
        <Link
          href={`/dashboard/curse/${trip.id}`}
          className="text-primary inline-flex items-center gap-1 font-medium"
        >
          {t.openTrip} <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default async function TrackingPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.tracking;

  const board = await getTrackingBoard(sessionUser, companyId);
  const fleet = buildFleetPositions(board.trips);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t.title}</h2>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Radio className="size-5" />}
          label={t.kpiOnRoad}
          value={String(board.onRoad)}
          tone="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon={<Clock className="size-5" />}
          label={t.kpiWaiting}
          value={String(board.waiting)}
          tone="bg-amber-100 text-amber-700"
        />
        <StatCard
          icon={<Truck className="size-5" />}
          label={t.kpiIdle}
          value={String(board.idleTrucks)}
          tone="bg-slate-100 text-slate-700"
        />
        <StatCard
          icon={<Truck className="size-5" />}
          label={t.kpiFleet}
          value={String(board.fleetSize)}
          tone="bg-violet-100 text-violet-700"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">{t.mapHeading}</h3>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Satellite className="size-3.5" />
            {t.estimated}
          </span>
        </div>
        <LiveFleetMap
          trucks={fleet}
          height={360}
          liveLabel={t.mapLiveTrucks}
          emptyLabel={t.mapEmpty}
          legend={{
            in_transit: t.mapLegendInTransit,
            assigned: t.mapLegendAssigned,
            route: t.mapLegendRoute,
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-xl border p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{t.routesHeading}</h3>
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Satellite className="size-3.5" />
              {t.estimated}
            </span>
          </div>

          {board.trips.length === 0 ? (
            <div className="bg-muted/40 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-center text-sm">
              <Route className="size-7" />
              <span className="max-w-xs">{t.noActive}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {board.trips.map((trip) => (
                <RouteRow key={trip.id} trip={trip} locale={locale} t={t} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">{t.idleHeading}</h3>
            {board.idle.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.noIdle}</p>
            ) : (
              <ul className="space-y-1.5">
                {board.idle.map((truck) => (
                  <li key={truck.id}>
                    <Link
                      href={`/dashboard/flota/${truck.id}`}
                      className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                        <Truck className="size-4" />
                      </span>
                      <span className="flex-1 font-medium">{truck.registrationNumber}</span>
                      <ArrowRight className="text-muted-foreground size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
            <Satellite className="mt-0.5 size-4 shrink-0" />
            <p>{t.gpsNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
