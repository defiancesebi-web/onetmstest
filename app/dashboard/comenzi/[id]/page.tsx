import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getOrderById, calculateMargin } from "@/lib/data/orders";
import { ORDER_STATUS_LABELS, STOP_TYPE_LABELS } from "@/lib/orderStatus";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatusActions } from "./status-actions";
import { OrderEditForm } from "./edit-form";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(value);
}

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

  const margin = calculateMargin(order);

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/comenzi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        ← Înapoi la comenzi
      </Link>

      <PageHeader
        title={`Comanda ${order.orderNumber}`}
        description={
          <>
            {order.client.name} · Referință: {order.clientReference} ·{" "}
            <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
          </>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Stare</h2>
        <StatusActions orderId={order.id} status={order.status} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Bani</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Preț</dt>
            <dd>
              {order.salePrice.toString()} {order.currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Echivalent RON</dt>
            <dd>{order.salePriceRon.toString()} RON</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cost estimat</dt>
            <dd>{order.estimatedCostRon ? `${order.estimatedCostRon.toString()} RON` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Marjă</dt>
            <dd>{margin ? `${margin.marginRon} RON (${margin.marginPercent}%)` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Curs folosit</dt>
            <dd>
              {order.exchangeRate.toString()} din {formatDate(order.exchangeRateDate)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Termen de plată</dt>
            <dd>{order.paymentTermDays} zile</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Documente primite</dt>
            <dd>{order.documentsReceivedAt ? formatDate(order.documentsReceivedAt) : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Marfă</h2>
        <p className="text-sm">
          {order.cargoDescription}
          {order.cargoWeightKg && ` · ${order.cargoWeightKg.toString()} kg`}
          {order.cargoPackaging && ` · ${order.cargoPackaging}`}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Traseu</h2>
        <ol className="space-y-3">
          {order.stops.map((stop) => (
            <li key={stop.id} className="rounded-lg border p-4 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium">{stop.sequence}.</span>
                <Badge>{STOP_TYPE_LABELS[stop.type]}</Badge>
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
                  Contact: {stop.contactName}
                  {stop.contactPhone && ` · ${stop.contactPhone}`}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 border-t pt-8">
        <h2 className="mb-3 text-sm font-medium">Modifică datele comenzii</h2>
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
      </section>

      <section className="mt-10 border-t pt-8">
        <h2 className="mb-3 text-sm font-medium">Planificare</h2>
        {order.tripId ? (
          <p className="text-sm">
            Comanda este pe cursa{" "}
            <Link href={`/dashboard/curse/${order.tripId}`} className="underline">
              vezi cursa
            </Link>
            .
          </p>
        ) : order.status === "CONFIRMED" ? (
          <Link
            href={`/dashboard/curse/noua?comanda=${order.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Planifică pe o cursă
          </Link>
        ) : (
          <p className="text-muted-foreground text-sm">
            Comanda poate fi planificată după ce este confirmată.
          </p>
        )}
      </section>
    </div>
  );
}
