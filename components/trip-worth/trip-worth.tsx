"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, X, ThumbsUp, TriangleAlert, ThumbsDown, ArrowRight } from "lucide-react";
import { loadTripWorthBasisAction } from "./actions";
import { approxRoadKm } from "@/lib/geo/cities";
import type { TripWorthBasis } from "@/lib/data/trip-worth";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Verdict = "worth" | "tight" | "no";

export function TripWorth({ t, locale }: { t: Dictionary["tripWorth"]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [basis, setBasis] = useState<TripWorthBasis | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [km, setKm] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"RON" | "EUR">("RON");
  const [rate, setRate] = useState("5");
  const [truckId, setTruckId] = useState("");
  const [costPerKm, setCostPerKm] = useState("");

  // Lazy-load the fleet cost basis the first time the panel opens.
  useEffect(() => {
    if (!open || basis) return;
    loadTripWorthBasisAction().then((b) => {
      setBasis(b);
      if (b.fleetCostPerKm != null && costPerKm === "") setCostPerKm(String(b.fleetCostPerKm));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-distance from the two cities (offline gazetteer); still editable.
  const bothKnown = useMemo(() => approxRoadKm(from, to), [from, to]);
  useEffect(() => {
    if (bothKnown != null) setKm(String(bothKnown));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothKnown]);

  function pickTruck(id: string) {
    setTruckId(id);
    if (id === "") {
      if (basis?.fleetCostPerKm != null) setCostPerKm(String(basis.fleetCostPerKm));
    } else {
      const tr = basis?.trucks.find((x) => x.id === id);
      if (tr) setCostPerKm(String(tr.costPerKm));
    }
  }

  const intl = locale === "ro" ? "ro-RO" : "en-US";
  const money = (n: number, cur: "RON" | "EUR" = "RON") =>
    new Intl.NumberFormat(intl, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

  const calc = useMemo(() => {
    const kmN = Number(km);
    const cpkN = Number(costPerKm);
    const priceN = Number(price);
    const rateN = Number(rate) || 0;
    const priceRon = currency === "EUR" ? priceN * rateN : priceN;
    const valid = kmN > 0 && cpkN > 0 && priceRon > 0;
    if (!valid) return null;
    const cost = kmN * cpkN;
    const profit = priceRon - cost;
    const margin = (profit / priceRon) * 100;
    const revPerKm = priceRon / kmN;
    const toCur = (ron: number) => (currency === "EUR" && rateN > 0 ? ron / rateN : ron);
    const verdict: Verdict = margin < 0 ? "no" : margin < 10 ? "tight" : "worth";
    return {
      cost,
      profit,
      margin,
      revPerKm,
      cpk: cpkN,
      verdict,
      breakEven: toCur(cost),
      target15: toCur(cost / 0.85),
    };
  }, [km, costPerKm, price, currency, rate]);

  const styles: Record<Verdict, { box: string; chip: string; Icon: typeof ThumbsUp; label: string; msg: string }> = {
    worth: { box: "border-emerald-200 bg-emerald-50", chip: "text-emerald-700", Icon: ThumbsUp, label: t.verdictWorth, msg: t.msgWorth },
    tight: { box: "border-amber-200 bg-amber-50", chip: "text-amber-800", Icon: TriangleAlert, label: t.verdictTight, msg: t.msgTight },
    no: { box: "border-rose-200 bg-rose-50", chip: "text-rose-700", Icon: ThumbsDown, label: t.verdictNo, msg: t.msgNo },
  };

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 fixed bottom-[92px] right-6 z-[1100] inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-colors"
      >
        <Gauge className="size-5" />
        <span className="hidden sm:inline">{t.launch}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-card flex max-h-[88vh] w-[440px] max-w-full flex-col overflow-hidden rounded-2xl border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <Gauge className="text-primary size-5" />
                  {t.title}
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">{t.subtitle}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="hover:bg-muted grid size-8 place-items-center rounded-md" aria-label={t.close}>
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {/* Route */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="tw-from">{t.fromCity}</Label>
                  <Input id="tw-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Cluj" />
                </div>
                <ArrowRight className="text-muted-foreground mb-2.5 size-4" />
                <div className="space-y-1">
                  <Label htmlFor="tw-to">{t.toCity}</Label>
                  <Input id="tw-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="București" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="tw-km">{t.km}</Label>
                  <Input id="tw-km" type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} />
                  {from && to && bothKnown == null && (
                    <p className="text-[11px] text-amber-700">{t.cityUnknown}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tw-price">{t.price}</Label>
                  <div className="flex gap-1.5">
                    <Input id="tw-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="flex-1" />
                    <div className="bg-muted flex rounded-md p-0.5 text-xs font-semibold">
                      {(["RON", "EUR"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCurrency(c)}
                          className={cn("rounded px-2", currency === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {currency === "EUR" && (
                  <div className="space-y-1">
                    <Label htmlFor="tw-rate">{t.rate}</Label>
                    <Input id="tw-rate" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="tw-truck">{t.truck}</Label>
                  <select id="tw-truck" value={truckId} onChange={(e) => pickTruck(e.target.value)} className="select-native w-full">
                    <option value="">{t.fleetAvg}</option>
                    {basis?.trucks.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tw-cpk">{t.costPerKm}</Label>
                  <Input id="tw-cpk" type="number" step="0.01" min="0" value={costPerKm} onChange={(e) => setCostPerKm(e.target.value)} />
                </div>
              </div>

              {basis && basis.fleetCostPerKm == null && costPerKm === "" && (
                <p className="text-[11px] text-amber-700">{t.noBasis}</p>
              )}

              {/* Verdict */}
              {calc ? (
                <div className={cn("rounded-xl border p-4", styles[calc.verdict].box)}>
                  <div className="flex items-center justify-between">
                    <span className={cn("inline-flex items-center gap-2 text-lg font-extrabold", styles[calc.verdict].chip)}>
                      {(() => {
                        const I = styles[calc.verdict].Icon;
                        return <I className="size-6" />;
                      })()}
                      {styles[calc.verdict].label}
                    </span>
                    <span className={cn("text-2xl font-extrabold tabular-nums", styles[calc.verdict].chip)}>
                      {calc.margin >= 0 ? "+" : ""}
                      {calc.margin.toFixed(0)}%
                    </span>
                  </div>
                  <p className={cn("mt-1 text-sm font-medium", styles[calc.verdict].chip)}>{styles[calc.verdict].msg}</p>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">{t.estCost}</span>
                    <span className="text-right font-semibold tabular-nums">{money(calc.cost)}</span>
                    <span className="text-muted-foreground">{t.profit}</span>
                    <span className={cn("text-right font-semibold tabular-nums", calc.profit < 0 ? "text-rose-600" : "text-emerald-600")}>
                      {money(calc.profit)}
                    </span>
                    <span className="text-muted-foreground">{t.revPerKm}</span>
                    <span className="text-right font-semibold tabular-nums">
                      {money(calc.revPerKm)} <span className="text-muted-foreground font-normal">/ {money(calc.cpk)}</span>
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 border-t pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.breakEven}</span>
                      <span className="font-semibold tabular-nums">{money(calc.breakEven, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.targetPrice}</span>
                      <span className="font-semibold tabular-nums">{money(calc.target15, currency)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
                  {t.enterData}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
