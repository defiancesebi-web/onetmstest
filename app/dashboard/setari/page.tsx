import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { getDictionary } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { CompanySettingsForm } from "./settings-form";

export default async function CompanySettingsPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const dict = await getDictionary();
  const t = dict.settings;
  const isAdmin = session!.user.role === "COMPANY_ADMIN";

  const company = await getCompanyForSession(sessionUser);

  return (
    <div className="max-w-2xl">
      <PageHeader title={t.title} description={t.description} />

      {!isAdmin && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t.adminOnly}
        </p>
      )}

      <CompanySettingsForm
        t={t}
        values={{
          name: company?.name ?? "",
          logo: company?.logo ?? null,
          cui: company?.cui ?? "",
          regCom: company?.regCom ?? "",
          shareCapital: company?.shareCapital ?? "",
          address: company?.address ?? "",
          city: company?.city ?? "",
          county: company?.county ?? "",
          postalCode: company?.postalCode ?? "",
          phone: company?.phone ?? "",
          email: company?.email ?? "",
          website: company?.website ?? "",
          iban: company?.iban ?? "",
          bankName: company?.bankName ?? "",
          vatPayer: company?.vatPayer ?? true,
          invoiceSeries: company?.invoiceSeries ?? "",
        }}
      />
    </div>
  );
}
