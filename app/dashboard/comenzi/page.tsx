import Link from "next/link";
import { auth } from "@/auth";
import { listOrdersRich } from "@/lib/data/orders";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { toDateKey } from "@/lib/documentStatus";
import { approxRoadKm } from "@/lib/geo/cities";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { OrdersList, type OrderRow } from "./orders-list";

export default async function ComenziPage() {
  const session = await auth();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.loads;

  const orders = await listOrdersRich(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  const money = new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
    maximumFractionDigits: 2,
  });

  const rows: OrderRow[] = orders.map((o) => {
    const loading = o.stops.find((s) => s.type === "LOADING") ?? o.stops[0] ?? null;
    const unloading =
      [...o.stops].reverse().find((s) => s.type === "UNLOADING") ?? o.stops[o.stops.length - 1] ?? null;
    const driverName = o.trip?.primaryDriver
      ? `${o.trip.primaryDriver.lastName} ${o.trip.primaryDriver.firstName}`.trim()
      : null;
    const truckReg = o.trip?.tractorUnit?.registrationNumber ?? null;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      clientReference: o.clientReference,
      clientId: o.clientId,
      clientName: o.client.name,
      status: o.status,
      cargo: o.cargoDescription,
      priceLabel: `${money.format(Number(o.salePrice))} ${o.currency}`,
      originCity: loading?.city ?? null,
      originDate: loading ? toDateKey(loading.scheduledDate) : null,
      destCity: unloading?.city ?? null,
      destDate: unloading ? toDateKey(unloading.scheduledDate) : null,
      driverId: driverName,
      driverName,
      truckId: truckReg,
      truckReg,
      distanceKm: approxRoadKm(loading?.city ?? null, unloading?.city ?? null),
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={d.title}
        description={d.description}
        actions={
          <Link href="/dashboard/comenzi/noua" className={buttonVariants()}>
            {d.newLabel}
          </Link>
        }
      />
      <OrdersList rows={rows} t={d} locale={locale} />
    </div>
  );
}
