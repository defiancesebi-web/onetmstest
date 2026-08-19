import Link from "next/link";
import { auth } from "@/auth";
import { listVehicles } from "@/lib/data/vehicles";
import { listDrivers } from "@/lib/data/drivers";
import { getOrderById } from "@/lib/data/orders";
import { toDateKey } from "@/lib/documentStatus";
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
  // stops already say.
  const order = comanda ? await getOrderById(sessionUser, comanda) : null;
  const loadingDates = order?.stops.filter((s) => s.type === "LOADING") ?? [];
  const unloadingDates = order?.stops.filter((s) => s.type === "UNLOADING") ?? [];
  const today = toDateKey(new Date());

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
        description={order ? `Se planifică comanda ${order.orderNumber}.` : undefined}
      />

      <NewTripForm
        tractorUnits={vehicles
          .filter((v) => v.type !== "SEMI_TRAILER")
          .map((v) => ({ id: v.id, label: v.registrationNumber }))}
        trailers={vehicles
          .filter((v) => v.type === "SEMI_TRAILER")
          .map((v) => ({ id: v.id, label: v.registrationNumber }))}
        drivers={drivers.map((d) => ({ id: d.id, label: `${d.lastName} ${d.firstName}` }))}
        orderId={order?.id}
        defaultStartsAt={defaultStartsAt}
        defaultEndsAt={defaultEndsAt}
      />
    </div>
  );
}
