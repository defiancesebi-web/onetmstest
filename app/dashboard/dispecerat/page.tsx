import Link from "next/link";
import { auth } from "@/auth";
import { listTrips, listUnplannedOrders } from "@/lib/data/trips";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { TRIP_STATUS_I18N, tripStatusLabel } from "@/lib/labels";
import type { TripStatus } from "@/lib/generated/prisma/enums";
import { PageHeader } from "@/components/page-header";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";

const STATUS_VALUES = Object.keys(TRIP_STATUS_I18N.ro) as TripStatus[];

export default async function DispeceratPage({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string }>;
}) {
  const { stare } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.dispatch;
  const intlLocale = locale === "ro" ? "ro-RO" : "en-US";

  // The server runs in UTC and every date here is a @db.Date column, so
  // formatting without an explicit timeZone reads the correct Bucharest day.
  const formatDate = (value: Date) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(value);

  const status = STATUS_VALUES.includes(stare as TripStatus) ? (stare as TripStatus) : undefined;

  const [unplanned, trips] = await Promise.all([
    listUnplannedOrders(sessionUser, companyId),
    listTrips(sessionUser, companyId, { status }),
  ]);

  return (
    <div>
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/curse/noua" className={buttonVariants()}>
            {d.newTrip}
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-bold tracking-[0.13em] uppercase">
            {d.unplanned}{" "}
            <span className="text-muted-foreground font-semibold">({unplanned.length})</span>
          </h2>
          {unplanned.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              {d.noUnplanned}
            </p>
          ) : (
            <ul className="space-y-2">
              {unplanned.map((order) => {
                const first = order.stops[0];
                const last = order.stops[order.stops.length - 1];
                return (
                  <li key={order.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/comenzi/${order.id}`}
                        className="text-primary font-semibold"
                      >
                        {order.orderNumber}
                      </Link>
                      <Link
                        href={`/dashboard/curse/noua?comanda=${order.id}`}
                        className={`${buttonVariants({ variant: "outline", size: "sm" })} border-primary text-primary`}
                      >
                        {d.plan}
                      </Link>
                    </div>
                    <p className="text-muted-foreground mt-1">{order.client.name}</p>
                    {first && last && (
                      <p className="text-muted-foreground">
                        {first.city} → {last.city} · {formatDate(first.scheduledDate)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold tracking-[0.13em] uppercase">
              {d.trips} <span className="text-muted-foreground font-semibold">({trips.length})</span>
            </h2>
            <form className="flex items-center gap-2">
              <select
                name="stare"
                defaultValue={stare ?? ""}
                className="rounded-lg border px-2 py-1 text-sm"
              >
                <option value="">{d.allStatuses}</option>
                {STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {tripStatusLabel(value, locale)}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                {d.filter}
              </Button>
            </form>
          </div>

          {trips.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              {d.noTrips}
            </p>
          ) : (
            <ul className="space-y-2">
              {trips.map((trip) => (
                <li key={trip.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/curse/${trip.id}`}
                      className="text-primary font-semibold"
                    >
                      {trip.tripNumber}
                    </Link>
                    <TripStatusBadge status={trip.status} locale={locale} />
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {formatDate(trip.startsAt)} – {formatDate(trip.endsAt)}
                  </p>
                  <p className="text-muted-foreground">
                    {trip.tractorUnit?.registrationNumber ?? d.noTruck}
                    {trip.trailer && ` + ${trip.trailer.registrationNumber}`}
                    {trip.primaryDriver &&
                      ` · ${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`}
                  </p>
                  <p className="text-muted-foreground">
                    {trip.orders.length === 0
                      ? d.noOrders
                      : trip.orders.map((o) => o.orderNumber).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
