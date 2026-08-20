import Link from "next/link";
import { auth } from "@/auth";
import { listVehicles } from "@/lib/data/vehicles";
import { listDrivers } from "@/lib/data/drivers";
import { getOrderById } from "@/lib/data/orders";
import { PLANNABLE_ORDER_STATUSES } from "@/lib/data/trips";
import { toDateKey, todayKeyInBucharest } from "@/lib/documentStatus";
import { ORDER_STATUS_LABELS } from "@/lib/orderStatus";
import { PageHeader } from "@/components/page-header";
import { NewTripForm } from "./new-trip-form";

export default async function CursaNouaPage({
  searchParams,
}: {
  searchParams: Promise<{ comanda?: string }>;
}) {
  const { comanda } = await searchParams;
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;

  const [vehicles, drivers] = await Promise.all([
    listVehicles(sessionUser, companyId),
    listDrivers(sessionUser, companyId),
  ]);

  // Seeding the dates from the order saves the dispatcher retyping what the
  // stops already say. A genuinely missing or cross-tenant order (null from
  // getOrderById) just falls through to the plain form below, same as today.
  const order = comanda ? await getOrderById(sessionUser, comanda) : null;

  // An order that exists but can't be planned — not confirmed yet, or
  // already riding another trip — must not be silently pre-attached: the
  // dispatcher would create the trip, see "Nicio comandă atașată." with no
  // explanation, and wrongly believe the order was planned. Render the form
  // anyway (do not notFound() a merely-ineligible order) and say why.
  const ineligibleReason = !order
    ? null
    : order.tripId
      ? `Comanda ${order.orderNumber} este deja planificată pe altă cursă.`
      : !(PLANNABLE_ORDER_STATUSES as readonly string[]).includes(order.status)
        ? `Comanda ${order.orderNumber} nu poate fi planificată cât este „${ORDER_STATUS_LABELS[order.status]}” — poți crea cursa, dar va trebui să o atașezi manual.`
        : null;
  const eligibleOrderId = order && !ineligibleReason ? order.id : undefined;

  const loadingDates = order?.stops.filter((s) => s.type === "LOADING") ?? [];
  const unloadingDates = order?.stops.filter((s) => s.type === "UNLOADING") ?? [];
  // toDateKey reads UTC parts — right for the @db.Date stop columns below,
  // wrong for a live instant: between midnight and 02:00/03:00 Bucharest it
  // would default the form to yesterday, and night dispatch is normal here.
  const today = todayKeyInBucharest();

  const defaultStartsAt =
    loadingDates.length > 0
      ? toDateKey(new Date(Math.min(...loadingDates.map((s) => s.scheduledDate.getTime()))))
      : today;
  const defaultEndsAt =
    unloadingDates.length > 0
      ? toDateKey(new Date(Math.max(...unloadingDates.map((s) => s.scheduledDate.getTime()))))
      : today;

  return (
    <div>
      <Link
        href="/dashboard/dispecerat"
        className="text-muted-foreground mb-4 inline-block text-sm underline"
      >
        ← Înapoi la dispecerat
      </Link>
      <PageHeader
        title="Cursă nouă"
        description={
          ineligibleReason ?? (order ? `Se planifică comanda ${order.orderNumber}.` : undefined)
        }
      />

      <NewTripForm
        tractorUnits={vehicles
          .filter((v) => v.type !== "SEMI_TRAILER")
          .map((v) => ({ id: v.id, label: v.registrationNumber }))}
        trailers={vehicles
          .filter((v) => v.type === "SEMI_TRAILER")
          .map((v) => ({ id: v.id, label: v.registrationNumber }))}
        drivers={drivers.map((d) => ({ id: d.id, label: `${d.lastName} ${d.firstName}` }))}
        orderId={eligibleOrderId}
        defaultStartsAt={defaultStartsAt}
        defaultEndsAt={defaultEndsAt}
      />
    </div>
  );
}
