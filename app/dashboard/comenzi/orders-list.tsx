"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, Truck, User, Package, X } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { OrderStatusPill } from "@/components/dashboard/order-status-pill";
import { ORDER_STATUS_I18N, orderStatusLabel } from "@/lib/labels";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type OrderRow = {
  id: string;
  orderNumber: string;
  clientReference: string;
  clientId: string;
  clientName: string;
  status: OrderStatus;
  cargo: string;
  priceLabel: string;
  originCity: string | null;
  originDate: string | null;
  destCity: string | null;
  destDate: string | null;
  driverId: string | null;
  driverName: string | null;
  truckId: string | null;
  truckReg: string | null;
  distanceKm: number | null;
};

const STATUS_VALUES = Object.keys(ORDER_STATUS_I18N.ro) as OrderStatus[];

function dedupe(pairs: { value: string; label: string }[]) {
  const seen = new Map<string, string>();
  for (const p of pairs) if (p.value && !seen.has(p.value)) seen.set(p.value, p.label);
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

export function OrdersList({
  rows,
  t,
  locale,
}: {
  rows: OrderRow[];
  t: Dictionary["loads"];
  locale: Locale;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [clientId, setClientId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [commodity, setCommodity] = useState("");

  const clientOpts = useMemo(() => dedupe(rows.map((r) => ({ value: r.clientId, label: r.clientName }))), [rows]);
  const driverOpts = useMemo(
    () => dedupe(rows.filter((r) => r.driverId).map((r) => ({ value: r.driverId!, label: r.driverName ?? "—" }))),
    [rows]
  );
  const truckOpts = useMemo(
    () => dedupe(rows.filter((r) => r.truckId).map((r) => ({ value: r.truckId!, label: r.truckReg ?? "—" }))),
    [rows]
  );
  const commodityOpts = useMemo(
    () => dedupe(rows.filter((r) => r.cargo).map((r) => ({ value: r.cargo, label: r.cargo }))),
    [rows]
  );

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" }),
    [locale]
  );
  const fmtDate = (key: string | null) => (key ? dateFmt.format(new Date(`${key}T00:00:00Z`)) : "—");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (clientId && r.clientId !== clientId) return false;
      if (driverId && r.driverId !== driverId) return false;
      if (truckId && r.truckId !== truckId) return false;
      if (commodity && r.cargo !== commodity) return false;
      if (q) {
        const hay = `${r.orderNumber} ${r.clientReference} ${r.clientName} ${r.originCity ?? ""} ${r.destCity ?? ""} ${r.cargo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status, clientId, driverId, truckId, commodity]);

  const hasFilters = !!(search || status || clientId || driverId || truckId || commodity);
  function clearAll() {
    setSearch("");
    setStatus("");
    setClientId("");
    setDriverId("");
    setTruckId("");
    setCommodity("");
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="bg-card flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-md border px-3">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <div className="w-44">
          <Combobox value={clientId} onChange={setClientId} options={clientOpts} placeholder={t.filterClient} noneLabel={t.allClients} showAvatars />
        </div>
        <div className="w-40">
          <Combobox value={driverId} onChange={setDriverId} options={driverOpts} placeholder={t.filterDriver} noneLabel={t.allDrivers} showAvatars />
        </div>
        <div className="w-40">
          <Combobox value={truckId} onChange={setTruckId} options={truckOpts} placeholder={t.filterTruck} noneLabel={t.allTrucks} />
        </div>
        <div className="w-40">
          <Combobox value={commodity} onChange={setCommodity} options={commodityOpts} placeholder={t.filterCommodity} noneLabel={t.allCommodities} />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm"
          >
            <X className="size-4" /> {t.clearFilters}
          </button>
        )}
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill active={status === ""} onClick={() => setStatus("")} label={t.allStatuses} />
        {STATUS_VALUES.map((s) => (
          <StatusPill key={s} active={status === s} onClick={() => setStatus(s)} label={orderStatusLabel(s, locale)} />
        ))}
        <span className="text-muted-foreground ml-auto text-sm tabular-nums">
          {t.showingCount.replace("{n}", String(filtered.length))}
        </span>
      </div>

      {/* Rows */}
      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">{t.notFound}</p>
        ) : (
          filtered.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/comenzi/${r.id}`}
              className="hover:bg-muted/40 grid grid-cols-1 gap-3 border-b px-4 py-3 transition-colors last:border-0 md:grid-cols-[150px_1fr_190px] md:items-center"
            >
              {/* ID + status */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-semibold">{r.orderNumber}</span>
                  <OrderStatusPill status={r.status} locale={locale} />
                </div>
                {r.clientReference && (
                  <div className="text-muted-foreground truncate text-xs">{r.clientReference}</div>
                )}
              </div>

              {/* Route */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.originCity ?? "—"}</div>
                  <div className="text-muted-foreground text-xs">{fmtDate(r.originDate)}</div>
                </div>
                <div className="flex shrink-0 flex-col items-center px-1">
                  {r.distanceKm != null && (
                    <span className="text-muted-foreground text-[10px] tabular-nums">~{r.distanceKm} km</span>
                  )}
                  <ArrowRight className="text-muted-foreground size-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.destCity ?? "—"}</div>
                  <div className="text-muted-foreground text-xs">{fmtDate(r.destDate)}</div>
                </div>
                <div className="text-muted-foreground ml-auto hidden shrink-0 items-center gap-3 text-xs lg:flex">
                  <span className="inline-flex items-center gap-1">
                    <Package className="size-3.5" /> {r.cargo || "—"}
                  </span>
                  {r.driverName && (
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3.5" /> {r.driverName}
                    </span>
                  )}
                  {r.truckReg && (
                    <span className="inline-flex items-center gap-1">
                      <Truck className="size-3.5" /> {r.truckReg}
                    </span>
                  )}
                </div>
              </div>

              {/* Client + price */}
              <div className="md:text-right">
                <div className="truncate text-sm font-medium">{r.clientName}</div>
                <div className="text-sm font-semibold tabular-nums">{r.priceLabel}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatusPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground hover:border-muted-foreground/40"
      )}
    >
      {label}
    </button>
  );
}
