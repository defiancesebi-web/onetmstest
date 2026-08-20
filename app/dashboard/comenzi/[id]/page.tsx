import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Truck, User, Building2, Package, MapPin, Route as RouteIcon } from "lucide-react";
import { auth } from "@/auth";
import { getOrderById, calculateMargin } from "@/lib/data/orders";
import { PLANNABLE_ORDER_STATUSES } from "@/lib/data/trips";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { orderStatusLabel, stopTypeLabel } from "@/lib/labels";
import { Tabs } from "@/components/tabs";
import { OrderStatusPill } from "@/components/dashboard/order-status-pill";
import { buttonVariants } from "@/components/ui/button";
import { StatusActions } from "./status-actions";
import { OrderEditForm } from "./edit-form";

const LIFECYCLE: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "IN_PROGRESS",
  "DELIVERED",
  "DOCUMENTS_RECEIVED",
  "INVOICED",
];

export default async function ComandaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const order = await getOrderById(
    { role: session!.user.role, companyId: session!.user.companyId },
    id
  );
  if (!order) notFound();

  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.order;
  const intlLocale = locale === "ro" ? "ro-RO" : "en-US";
  const formatDate = (value: Date) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(value);
  const money = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  });

  const margin = calculateMargin(order);
  const first = order.stops[0];
  const last = order.stops[order.stops.length - 1];
  const currentIndex = LIFECYCLE.indexOf(order.status);
  const driverName = order.trip?.primaryDriver
    ? `${order.trip.primaryDriver.lastName} ${order.trip.primaryDriver.firstName}`
    : "—";

  const info: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Building2 className="size-4" />, label: d.customer, value: order.client.name },
    { icon: <Truck className="size-4" />, label: d.carrier, value: d.ownFleet },
    { icon: <User className="size-4" />, label: d.driver, value: driverName },
    {
      icon: <Truck className="size-4" />,
      label: d.vehicle,
      value: order.trip?.tractorUnit?.registrationNumber ?? "—",
    },
    { icon: <Package className="size-4" />, label: d.commodity, value: order.cargoDescription },
    {
      icon: <Package className="size-4" />,
      label: d.weight,
      value: order.cargoWeightKg ? `${order.cargoWeightKg.toString()} kg` : "—",
    },
  ];

  const financial: { label: string; value: string; strong?: boolean }[] = [
    { label: d.salePrice, value: `${order.salePrice.toString()} ${order.currency}` },
    { label: d.ronEquiv, value: money.format(Number(order.salePriceRon)) },
    {
      label: d.estCost,
      value: order.estimatedCostRon ? money.format(Number(order.estimatedCostRon)) : "—",
    },
    { label: d.grossProfit, value: margin ? `${margin.marginRon} RON` : "—", strong: true },
    { label: d.margin, value: margin ? `${margin.marginPercent}%` : "—", strong: true },
  ];

  const overview = (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-4 font-semibold">{d.info}</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {info.map((row, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg">
                  {row.icon}
                </span>
                <span className="min-w-0">
                  <dt className="text-muted-foreground text-xs">{row.label}</dt>
                  <dd className="truncate font-medium">{row.value}</dd>
                </span>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{d.statusTitle}</h3>
            {first && last && (
              <span className="text-muted-foreground text-sm">
                {first.city} → {last.city}
              </span>
            )}
          </div>
          {order.status === "CANCELLED" ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{d.cancelled}</p>
          ) : (
            <ol className="flex flex-wrap items-center gap-y-3">
              {LIFECYCLE.map((step, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                return (
                  <li key={step} className="flex items-center">
                    <span
                      className={`grid size-7 place-items-center rounded-full text-xs font-bold ${
                        done
                          ? "bg-emerald-100 text-emerald-700"
                          : active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span className={`ml-1.5 text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>
                      {orderStatusLabel(step, locale)}
                    </span>
                    {i < LIFECYCLE.length - 1 && <span className="bg-border mx-2 h-px w-6" />}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-4 font-semibold">{d.financialSummary}</h3>
          <dl className="space-y-3 text-sm">
            {financial.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className={`tabular-nums ${row.strong ? "text-primary font-bold" : "font-medium"}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">{d.actions}</h3>
          <div className="space-y-3">
            <StatusActions orderId={order.id} status={order.status} />
            {order.trip ? (
              <Link
                href={`/dashboard/curse/${order.trip.id}`}
                className={`${buttonVariants({ variant: "outline", size: "sm" })} w-full`}
              >
                <RouteIcon className="size-4" /> {d.trip} {order.trip.tripNumber}
              </Link>
            ) : (
              (PLANNABLE_ORDER_STATUSES as readonly string[]).includes(order.status) && (
                <Link
                  href={`/dashboard/curse/noua?comanda=${order.id}`}
                  className={`${buttonVariants({ variant: "outline", size: "sm" })} w-full`}
                >
                  <MapPin className="size-4" /> {d.planOnTrip}
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const routeTab = (
    <ol className="space-y-3">
      {order.stops.map((stop) => (
        <li key={stop.id} className="bg-card rounded-xl border p-4 text-sm shadow-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold">{stop.sequence}.</span>
            <span className="bg-muted rounded px-2 py-0.5 text-xs font-medium">
              {stopTypeLabel(stop.type, locale)}
            </span>
            <span className="text-muted-foreground">{formatDate(stop.scheduledDate)}</span>
            {stop.timeFrom && (
              <span className="text-muted-foreground">
                {stop.timeFrom}
                {stop.timeTo && `–${stop.timeTo}`}
              </span>
            )}
          </div>
          <p>
            {stop.address}, {stop.city}, {stop.country}
          </p>
          {stop.contactName && (
            <p className="text-muted-foreground">
              {d.contact}: {stop.contactName}
              {stop.contactPhone && ` · ${stop.contactPhone}`}
            </p>
          )}
        </li>
      ))}
    </ol>
  );

  const financialTab = (
    <div className="bg-card max-w-2xl rounded-xl border p-5 shadow-sm">
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{d.price}</dt>
          <dd className="font-medium">
            {order.salePrice.toString()} {order.currency}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{d.ronEquiv}</dt>
          <dd className="font-medium">{money.format(Number(order.salePriceRon))}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{d.estCost}</dt>
          <dd className="font-medium">
            {order.estimatedCostRon ? money.format(Number(order.estimatedCostRon)) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{d.grossProfit}</dt>
          <dd className="text-primary font-bold">{margin ? `${margin.marginRon} RON` : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{d.margin}</dt>
          <dd className="text-primary font-bold">{margin ? `${margin.marginPercent}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{d.rateUsed}</dt>
          <dd className="font-medium">
            {order.exchangeRate.toString()} {d.rateFrom} {formatDate(order.exchangeRateDate)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{d.paymentTerm}</dt>
          <dd className="font-medium">
            {order.paymentTermDays} {d.days}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{d.docsReceived}</dt>
          <dd className="font-medium">
            {order.documentsReceivedAt ? formatDate(order.documentsReceivedAt) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );

  const editTab = (
    <div className="bg-card max-w-2xl rounded-xl border p-5 shadow-sm">
      <OrderEditForm
        orderId={order.id}
        values={{
          clientReference: order.clientReference,
          cargoDescription: order.cargoDescription,
          cargoWeightKg: order.cargoWeightKg?.toString() ?? null,
          cargoPackaging: order.cargoPackaging,
          salePrice: order.salePrice.toString(),
          currency: order.currency,
          estimatedCostRon: order.estimatedCostRon?.toString() ?? null,
          paymentTermDays: order.paymentTermDays,
          notes: order.notes,
        }}
      />
    </div>
  );

  const soon = (label: string) => (
    <div className="bg-muted/40 text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
      {label} — {d.soonSuffix}.
    </div>
  );

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/comenzi"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> {d.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
            <OrderStatusPill status={order.status} locale={locale} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {order.client.name} · {d.ref}: {order.clientReference} · {d.created}{" "}
            {formatDate(order.createdAt)}
          </p>
        </div>
      </div>

      <Tabs
        soonLabel={d.soonSuffix}
        tabs={[
          { key: "overview", label: d.tabOverview, content: overview },
          { key: "route", label: d.tabRoute, content: routeTab },
          { key: "financial", label: d.tabFinancial, content: financialTab },
          { key: "edit", label: d.tabEdit, content: editTab },
          { key: "documents", label: d.tabDocuments, content: soon(d.soonDocuments), soon: true },
          { key: "activity", label: d.tabActivity, content: soon(d.soonActivity), soon: true },
          { key: "invoices", label: d.tabInvoices, content: soon(d.soonInvoices), soon: true },
        ]}
      />
    </div>
  );
}
