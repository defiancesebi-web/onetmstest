"use client";

import { type MouseEvent as ReactMouseEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Truck, User, Package, X } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/dashboard/order-status-pill";
import { ORDER_STATUS_I18N, orderStatusLabel } from "@/lib/labels";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { bulkSetOrderStatusAction } from "./actions";

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

  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  const statusOptions = STATUS_VALUES.map((s) => ({ value: s, label: orderStatusLabel(s, locale) }));

  function applyBulk() {
    if (!bulkStatus || selected.size === 0) return;
    const ids = [...selected];
    startTransition(async () => {
      await bulkSetOrderStatusAction(ids, bulkStatus as OrderStatus);
      setSelected(new Set());
      setBulkStatus("");
      router.refresh();
    });
  }

  function rowClick(e: ReactMouseEvent, id: string) {
    if ((e.target as HTMLElement).closest("input,a,button,label")) return;
    router.push(`/dashboard/comenzi/${id}`);
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="border-primary/30 bg-primary/5 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm font-semibold">
            {t.selectedCount.replace("{n}", String(selected.size))}
          </span>
          <div className="w-48">
            <Combobox
              value={bulkStatus}
              onChange={(v) => setBulkStatus(v as OrderStatus | "")}
              options={statusOptions}
              placeholder={t.bulkStatus}
            />
          </div>
          <Button size="sm" onClick={applyBulk} disabled={!bulkStatus || pending}>
            {t.bulkApply}
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground hover:text-foreground ml-auto text-sm"
          >
            {t.bulkDeselect}
          </button>
        </div>
      )}

      {/* Rows */}
      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">{t.notFound}</p>
        ) : (
          <>
            <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 accent-[#16a34a]"
                aria-label="select all"
              />
              <span className="text-muted-foreground text-[11px] font-bold tracking-[0.05em] uppercase">
                {t.title}
              </span>
            </div>
            {filtered.map((r) => (
            <div
              key={r.id}
              onClick={(e) => rowClick(e, r.id)}
              className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-colors last:border-0 md:grid md:grid-cols-[auto_150px_1fr_190px] md:items-center"
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                onClick={(e) => e.stopPropagation()}
                className="size-4 shrink-0 accent-[#16a34a]"
                aria-label={r.orderNumber}
              />
              <div className="min-w-0 flex-1 space-y-1 md:contents">
              {/* ID + status */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/comenzi/${r.id}`} className="text-primary font-semibold hover:underline">
                    {r.orderNumber}
                  </Link>
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
              </div>
            </div>
            ))}
          </>
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
