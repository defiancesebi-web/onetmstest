import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTripById, listUnplannedOrders } from "@/lib/data/trips";
import { listVehicles } from "@/lib/data/vehicles";
import { listDrivers } from "@/lib/data/drivers";
import { TRIP_EDITABLE_STATUSES } from "@/lib/tripStatus";
import { toDateKey } from "@/lib/documentStatus";
import { stopTypeLabel } from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { TripStatusActions } from "./trip-status-actions";
import { TripResourcesForm } from "./resources-form";
import { TripOrders } from "./trip-orders";

// Matches the convention in app/dashboard/comenzi/[id]/page.tsx and
// app/dashboard/dispecerat/page.tsx: the server runs in UTC and every date
// here is a @db.Date column, so formatting without an explicit timeZone
// already reads the correct Europe/Bucharest calendar day.
function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

/**
 * The resource lists only carry active records, so a truck sold after this trip
 * was planned would be missing from its own dropdown — and saving the form would
 * silently unassign it. This puts the currently-assigned one back, labelled.
 */
function withCurrent(
  options: { id: string; label: string }[],
  currentId: string | null,
  currentLabel: string | null | undefined,
  inactiveLabel: string
) {
  if (!currentId || options.some((o) => o.id === currentId)) return options;
  return [{ id: currentId, label: `${currentLabel ?? currentId} (${inactiveLabel})` }, ...options];
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ atasareEsuata?: string }>;
}) {
  const { id } = await params;
  const { atasareEsuata } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.tripDetail;

  const trip = await getTripById(sessionUser, id);
  if (!trip) notFound();

  const editable = (TRIP_EDITABLE_STATUSES as readonly string[]).includes(trip.status);

  const [vehicles, drivers, unplanned] = await Promise.all([
    listVehicles(sessionUser, session!.user.companyId!),
    listDrivers(sessionUser, session!.user.companyId!),
    listUnplannedOrders(sessionUser, session!.user.companyId!),
  ]);

  // All stops of all attached orders, in date order — the trip's actual route.
  const route = trip.orders
    .flatMap((order) => order.stops.map((stop) => ({ order: order.orderNumber, stop })))
    .sort((a, b) => a.stop.scheduledDate.getTime() - b.stop.scheduledDate.getTime());

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/dispecerat"
        className="text-muted-foreground mb-4 inline-block text-sm underline"
      >
        {t.back}
      </Link>

      <PageHeader
        title={`${t.tripTitle} ${trip.tripNumber}`}
        description={
          <>
            {formatDate(trip.startsAt, locale)} – {formatDate(trip.endsAt, locale)} ·{" "}
            <TripStatusBadge status={trip.status} locale={locale} />
          </>
        }
      />

      {atasareEsuata && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t.attachWarning}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">{t.statusHeading}</h2>
        <TripStatusActions tripId={trip.id} status={trip.status} locale={locale} t={t} />
      </section>

      {editable ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium">{t.allocation}</h2>
          <TripResourcesForm
            // Forces a full remount whenever the server-side window moves —
            // e.g. attachOrderToTrip/detachOrderFromTrip calling
            // recalcTripDates — because the form's fields are local state
            // seeded once from `values` and are never resynced on a prop
            // change. Without this the date inputs go stale after such a
            // move and the next submit would post the old window into
            // findResourceConflicts, checking the wrong interval entirely.
            // Safe across the conflict round trip: returning conflicts never
            // changes the stored dates, so this key is stable across that
            // re-render and the user's in-progress selection survives.
            key={`${toDateKey(trip.startsAt)}:${toDateKey(trip.endsAt)}`}
            tripId={trip.id}
            tractorUnits={withCurrent(
              vehicles
                .filter((v) => v.type !== "SEMI_TRAILER")
                .map((v) => ({ id: v.id, label: v.registrationNumber })),
              trip.tractorUnitId,
              trip.tractorUnit?.registrationNumber,
              t.inactive
            )}
            trailers={withCurrent(
              vehicles
                .filter((v) => v.type === "SEMI_TRAILER")
                .map((v) => ({ id: v.id, label: v.registrationNumber })),
              trip.trailerId,
              trip.trailer?.registrationNumber,
              t.inactive
            )}
            drivers={withCurrent(
              withCurrent(
                drivers.map((d) => ({ id: d.id, label: `${d.lastName} ${d.firstName}` })),
                trip.primaryDriverId,
                trip.primaryDriver && `${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`,
                t.inactive
              ),
              trip.secondDriverId,
              trip.secondDriver && `${trip.secondDriver.lastName} ${trip.secondDriver.firstName}`,
              t.inactive
            )}
            values={{
              startsAt: toDateKey(trip.startsAt),
              endsAt: toDateKey(trip.endsAt),
              tractorUnitId: trip.tractorUnitId ?? "",
              trailerId: trip.trailerId ?? "",
              primaryDriverId: trip.primaryDriverId ?? "",
              secondDriverId: trip.secondDriverId ?? "",
            }}
            t={dict.tripForm}
          />
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium">{t.allocation}</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t.tractor}</dt>
              <dd>{trip.tractorUnit?.registrationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.trailer}</dt>
              <dd>{trip.trailer?.registrationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.driver}</dt>
              <dd>
                {trip.primaryDriver
                  ? `${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.secondDriver}</dt>
              <dd>
                {trip.secondDriver
                  ? `${trip.secondDriver.lastName} ${trip.secondDriver.firstName}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <TripOrders
        tripId={trip.id}
        editable={editable}
        attached={trip.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          clientName: o.client.name,
        }))}
        attachable={unplanned.map((o) => ({
          id: o.id,
          label: `${o.orderNumber} — ${o.client.name}`,
        }))}
        t={t}
      />

      {route.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">{t.route}</h2>
          <ol className="space-y-2">
            {route.map(({ order, stop }) => (
              <li key={stop.id} className="rounded-lg border p-3 text-sm">
                <span className="font-medium">{stopTypeLabel(stop.type, locale)}</span>{" "}
                <span className="text-muted-foreground">
                  {formatDate(stop.scheduledDate, locale)} · {order}
                </span>
                <p>
                  {stop.address}, {stop.city}, {stop.country}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {trip.notes && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium">{t.notes}</h2>
          <p className="text-sm">{trip.notes}</p>
        </section>
      )}
    </div>
  );
}
