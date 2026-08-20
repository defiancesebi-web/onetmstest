import Link from "next/link";
import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { InvoicingSettingsForm } from "./settings-form";

export default async function InvoicingSettingsPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const dict = await getDictionary();
  const t = dict.invoiceSettings;

  const company = await getCompanyForSession(sessionUser);

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/facturare" className="text-muted-foreground mb-4 inline-block text-sm underline">
        {t.back}
      </Link>
      <PageHeader title={t.title} description={t.description} />

      <InvoicingSettingsForm
        t={t}
        values={{
          name: company?.name ?? "",
          cui: company?.cui ?? "",
          regCom: company?.regCom ?? "",
          address: company?.address ?? "",
          city: company?.city ?? "",
          county: company?.county ?? "",
          postalCode: company?.postalCode ?? "",
          iban: company?.iban ?? "",
          bankName: company?.bankName ?? "",
          vatPayer: company?.vatPayer ?? true,
          invoiceSeries: company?.invoiceSeries ?? "",
        }}
      />
    </div>
  );
}
