import Link from "next/link";
import {
  Package,
  Truck,
  CheckCircle2,
  Banknote,
  Percent,
  Contact,
  Users,
  Route,
  ArrowRight,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { auth } from "@/auth";
import { getCompanyForSession } from "@/lib/data/companies";
import { getExpiringDocuments } from "@/lib/data/documents";
import { getDashboardStats } from "@/lib/data/dashboard";
import { toDateKey, formatDateKey, DOCUMENT_TYPE_LABELS } from "@/lib/documentStatus";
import { orderStatusLabel } from "@/lib/labels";
import { getDictionary, getLocale } from "@/lib/i18n-server";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { AreaChart } from "@/components/dashboard/area-chart";
import { OrderStatusPill, STATUS_HEX } from "@/components/dashboard/order-status-pill";
import { DocumentStatusBadge } from "@/components/document-status-badge";

export default async function DashboardPage() {
  const session = await auth();
  const sessionUser = { role: session!.user.role, companyId: session!.user.companyId };
  const companyId = session!.user.companyId!;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = dict.dashboard;

  const [company, stats, expiring] = await Promise.all([
    getCompanyForSession(sessionUser),
    getDashboardStats(sessionUser, companyId),
    getExpiringDocuments(sessionUser, companyId),
  ]);

  const money = new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  });
  const weekday = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", { weekday: "short" });

  const donutSegments = stats.byStatus
    .filter((s) => s.count > 0)
    .map((s) => ({ label: orderStatusLabel(s.status, locale), value: s.count, color: STATUS_HEX[s.status] }));

  const areaPoints = stats.series.map((p) => ({
    label: weekday.format(new Date(`${p.key}T00:00:00`)),
    total: p.total,
    delivered: p.delivered,
  }));

  const deliveredPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  const quickActions = [
    { label: d.newLoad, href: "/dashboard/comenzi/noua", icon: Package },
    { label: d.newCustomer, href: "/dashboard/clienti/nou", icon: Contact },
    { label: d.newDriver, href: "/dashboard/soferi/nou", icon: Users },
    { label: d.addVehicle, href: "/dashboard/flota/nou", icon: Truck },
    { label: d.newTrip, href: "/dashboard/curse/noua", icon: Route },
  ];

  const alertsTitle = locale === "ro" ? "Alerte" : "Alerts";
  const allGood = locale === "ro" ? "Nimic nu expiră curând." : "Nothing expiring soon.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {d.greeting}, {session!.user.name}
        </h2>
        {company?.name && <p className="text-muted-foreground text-sm">{company.name}</p>}
      </div>

      {company?.status === "TRIAL" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="size-4 shrink-0" />
          {d.trialNotice}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<Package className="size-5" />} label={d.totalLoads} value={String(stats.total)} />
        <StatCard
          icon={<Truck className="size-5" />}
          label={d.inTransit}
          value={String(stats.inTransit)}
          tone="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          label={d.delivered}
          value={String(stats.delivered)}
          sub={`${deliveredPct}% ${d.vsLastWeek}`}
          tone="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={<Banknote className="size-5" />}
          label={d.revenue}
          value={money.format(stats.revenueRon)}
          tone="bg-violet-100 text-violet-700"
        />
        <StatCard
          icon={<Percent className="size-5" />}
          label={d.margin}
          value={stats.marginPct !== null ? `${stats.marginPct.toFixed(1)}%` : "—"}
          tone="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Overview + status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-xl border p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{d.overview}</h3>
            <span className="text-muted-foreground text-xs">{d.last7days}</span>
          </div>
          <div className="h-52">
            <AreaChart points={areaPoints} />
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-2 font-semibold">{d.byStatus}</h3>
          <div className="flex items-center justify-center py-1">
            <DonutChart segments={donutSegments} centerValue={String(stats.total)} centerLabel={d.total} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {donutSegments.length === 0 && <li className="text-muted-foreground text-sm">{d.noLoads}</li>}
            {donutSegments.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">{s.label}</span>
                <span className="text-muted-foreground tabular-nums">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent loads + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card overflow-hidden rounded-xl border shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="font-semibold">{d.recentLoads}</h3>
            <Link href="/dashboard/comenzi" className="text-primary inline-flex items-center gap-1 text-sm font-medium">
              {d.viewAll} <ArrowRight className="size-4" />
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="text-muted-foreground p-5 text-sm">{d.noLoads}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="px-5 py-2.5 font-medium">{d.colId}</th>
                    <th className="px-5 py-2.5 font-medium">{d.colRoute}</th>
                    <th className="px-5 py-2.5 font-medium">{d.colClient}</th>
                    <th className="px-5 py-2.5 font-medium">{d.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5">
                        <Link href={`/dashboard/comenzi/${o.id}`} className="text-primary font-medium">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-5 py-2.5">
                        {o.from && o.to ? `${o.from} → ${o.to}` : "—"}
                      </td>
                      <td className="px-5 py-2.5">{o.clientName}</td>
                      <td className="px-5 py-2.5">
                        <OrderStatusPill status={o.status} locale={locale} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">{d.quickActions}</h3>
          <ul className="space-y-1.5">
            {quickActions.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
                >
                  <span className="bg-primary/10 text-primary grid size-8 place-items-center rounded-lg">
                    <a.icon className="size-4" />
                  </span>
                  <span className="flex-1 font-medium">{a.label}</span>
                  <ArrowRight className="text-muted-foreground size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Live map placeholder + alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-xl border p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-3 font-semibold">{d.liveMap}</h3>
          <div className="bg-muted/50 text-muted-foreground flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm">
            <MapPin className="size-7" />
            <span className="max-w-xs">{d.mapSoon}</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">{alertsTitle}</h3>
          {expiring.length === 0 ? (
            <p className="text-muted-foreground text-sm">{allGood}</p>
          ) : (
            <ul className="space-y-2.5">
              {expiring.slice(0, 6).map((doc) => (
                <li key={doc.id}>
                  <Link href={doc.ownerHref} className="hover:bg-muted flex items-start gap-2 rounded-lg p-1.5">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{doc.ownerLabel}</span>
                      <span className="text-muted-foreground block text-xs">
                        {DOCUMENT_TYPE_LABELS[doc.type]} · {formatDateKey(toDateKey(doc.expiresAt))}
                      </span>
                    </span>
                    <DocumentStatusBadge status={doc.status} locale={locale} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
