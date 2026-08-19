import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTripById, listUnplannedOrders } from "@/lib/data/trips";
import { listVehicles } from "@/lib/data/vehicles";
import { listDrivers } from "@/lib/data/drivers";
import { TRIP_EDITABLE_STATUSES } from "@/lib/tripStatus";
import { toDateKey } from "@/lib/documentStatus";
import { STOP_TYPE_LABELS } from "@/lib/orderStatus";
import { PageHeader } from "@/components/page-header";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { TripStatusActions } from "./trip-status-actions";
import { TripResourcesForm } from "./resources-form";
import { TripOrders } from "./trip-orders";

// Matches the convention in app/dashboard/comenzi/[id]/page.tsx and
// app/dashboard/dispecerat/page.tsx: the server runs in UTC and every date
// here is a @db.Date column, so formatting without an explicit timeZone
// already reads the correct Europe/Bucharest calendar day.
function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(date);
}

/**
 * The resource lists only carry active records, so a truck sold after this trip
 * was planned would be missing from its own dropdown — and saving the form would
 * silently unassign it. This puts the currently-assigned one back, labelled.
 */
function withCurrent(
  options: { id: string; label: string }[],
  currentId: string | null,
  currentLabel: string | null | undefined
) {
  if (!currentId || options.some((o) => o.id === currentId)) return options;
  return [{ id: currentId, label: `${currentLabel ?? currentId} (inactiv)` }, ...options];
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };

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
        ← Înapoi la dispecerat
      </Link>

      <PageHeader
        title={`Cursa ${trip.tripNumber}`}
        description={
          <>
            {formatDate(trip.startsAt)} – {formatDate(trip.endsAt)} ·{" "}
            <TripStatusBadge status={trip.status} />
          </>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Stare</h2>
        <TripStatusActions tripId={trip.id} status={trip.status} />
      </section>

      {editable ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium">Alocare</h2>
          <TripResourcesForm
            tripId={trip.id}
            tractorUnits={withCurrent(
              vehicles
                .filter((v) => v.type !== "SEMI_TRAILER")
                .map((v) => ({ id: v.id, label: v.registrationNumber })),
              trip.tractorUnitId,
              trip.tractorUnit?.registrationNumber
            )}
            trailers={withCurrent(
              vehicles
                .filter((v) => v.type === "SEMI_TRAILER")
                .map((v) => ({ id: v.id, label: v.registrationNumber })),
              trip.trailerId,
              trip.trailer?.registrationNumber
            )}
            drivers={withCurrent(
              withCurrent(
                drivers.map((d) => ({ id: d.id, label: `${d.lastName} ${d.firstName}` })),
                trip.primaryDriverId,
                trip.primaryDriver && `${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`
              ),
              trip.secondDriverId,
              trip.secondDriver && `${trip.secondDriver.lastName} ${trip.secondDriver.firstName}`
            )}
            values={{
              startsAt: toDateKey(trip.startsAt),
              endsAt: toDateKey(trip.endsAt),
              tractorUnitId: trip.tractorUnitId ?? "",
              trailerId: trip.trailerId ?? "",
              primaryDriverId: trip.primaryDriverId ?? "",
              secondDriverId: trip.secondDriverId ?? "",
            }}
          />
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium">Alocare</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Cap tractor</dt>
              <dd>{trip.tractorUnit?.registrationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Semiremorcă</dt>
              <dd>{trip.trailer?.registrationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Șofer</dt>
              <dd>
                {trip.primaryDriver
                  ? `${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Al doilea șofer</dt>
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
      />

      {route.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium">Traseu</h2>
          <ol className="space-y-2">
            {route.map(({ order, stop }) => (
              <li key={stop.id} className="rounded-lg border p-3 text-sm">
                <span className="font-medium">{STOP_TYPE_LABELS[stop.type]}</span>{" "}
                <span className="text-muted-foreground">
                  {formatDate(stop.scheduledDate)} · {order}
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
          <h2 className="mb-2 text-sm font-medium">Observații</h2>
          <p className="text-sm">{trip.notes}</p>
        </section>
      )}
    </div>
  );
}
