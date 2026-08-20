import Link from "next/link";
import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { getEurRate } from "@/lib/bnr";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { OrderForm } from "./order-form";

export default async function ComandaNouaPage() {
  const session = await auth();
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.orderForm;
  const clients = await listClients(
    { role: session!.user.role, companyId: session!.user.companyId },
    session!.user.companyId!
  );

  // Fetched up front so the form can show the EUR rate and RON equivalent
  // before the user saves, per spec flow step 4 — not only after creation.
  // If BNR is unreachable, null tells the form to ask for a manual rate
  // proactively instead of waiting for a failed submit. Skipped when there
  // are no active clients, since the form isn't rendered in that case.
  let eurRate: { rate: string; date: string } | null = null;
  if (clients.length > 0) {
    try {
      eurRate = await getEurRate();
    } catch {
      eurRate = null;
    }
  }

  return (
    <div>
      <Link href="/dashboard/comenzi" className="text-muted-foreground mb-4 inline-block text-sm underline">
        {t.back}
      </Link>
      <PageHeader title={t.newTitle} />

      {clients.length === 0 ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">{t.noClients}</p>
          <Link href="/dashboard/clienti/nou" className={buttonVariants()}>
            {t.addFirstClient}
          </Link>
        </div>
      ) : (
        <OrderForm
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            paymentTermDays: c.paymentTermDays,
          }))}
          eurRate={eurRate}
          t={t}
          locale={locale}
        />
      )}
    </div>
  );
}
