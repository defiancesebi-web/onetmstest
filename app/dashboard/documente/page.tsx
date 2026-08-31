import { auth } from "@/auth";
import { listAllDocuments } from "@/lib/data/documents";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { toDateKey } from "@/lib/documentStatus";
import { documentTypeLabel } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { DocumentsList, type DocRow } from "./documents-list";

export default async function DocumentePage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.docsPage;

  const docs = await listAllDocuments(sessionUser, session!.user.companyId!);
  const companyLabel = locale === "ro" ? "Firmă" : "Company";
  const rows: DocRow[] = docs.map((d) => ({
    id: d.id,
    typeLabel: documentTypeLabel(d.type, locale),
    number: d.number,
    expiresKey: toDateKey(d.expiresAt),
    status: d.status,
    ownerKind: d.ownerKind,
    ownerLabel: d.ownerKind === "company" ? companyLabel : d.ownerLabel,
    ownerHref: d.ownerHref,
    imageData: d.imageData,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} description={t.description} />
      <DocumentsList rows={rows} t={t} locale={locale} />
    </div>
  );
}
