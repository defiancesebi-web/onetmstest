"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LaneOrder } from "@/lib/data/lanes";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// --- Leaflet from the CDN (same approach as the fleet map) -------------------
type LatLngTuple = [number, number];
interface LMap {
  setView(center: LatLngTuple, zoom: number): LMap;
  fitBounds(bounds: LatLngTuple[], opts?: unknown): LMap;
  invalidateSize(): void;
  remove(): void;
  eachLayer(fn: (layer: LLayer) => void): void;
  removeLayer(layer: LLayer): void;
}
interface LLayer {
  addTo(map: LMap): LLayer;
  bindTooltip(html: string, opts?: unknown): LLayer;
}
interface LTileLayer extends LLayer {
  _url?: string;
}
interface LeafletNS {
  map(el: HTMLElement, opts?: unknown): LMap;
  tileLayer(url: string, opts?: unknown): LTileLayer;
  polyline(points: LatLngTuple[], opts?: unknown): LLayer;
  circleMarker(center: LatLngTuple, opts?: unknown): LLayer;
}
// Read window.L via a cast — another component already augments Window.L with
// its own Leaflet typing, and two `declare global` blocks would clash.
const getL = (): LeafletNS | undefined => (window as unknown as { L?: LeafletNS }).L;
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
function loadLeaflet(): Promise<LeafletNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const existingL = getL();
  if (existingL) return Promise.resolve(existingL);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(getL()!));
      existing.addEventListener("error", reject);
      const now = getL();
      if (now) resolve(now);
      return;
    }
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => resolve(getL()!);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// --- Lane aggregation --------------------------------------------------------
type Metric = "frequency" | "revenue" | "profit";

type Lane = {
  key: string;
  originCity: string;
  destCity: string;
  from: LatLngTuple;
  to: LatLngTuple;
  freq: number;
  revenue: number; // total RON
  profit: number; // total RON
};

function withinRange(dateKey: string, range: "week" | "month" | "all"): boolean {
  if (range === "all") return true;
  const now = new Date();
  const d = new Date(`${dateKey}T00:00:00`);
  if (range === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  // week: rolling last 7 days including today
  const from = new Date(now);
  from.setDate(now.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  return d >= from && d <= now;
}

const HOME: LatLngTuple = [45.9, 25.0];

export function LaneVisualizer({
  orders,
  t,
  locale,
}: {
  orders: LaneOrder[];
  t: Dictionary["laneViz"];
  locale: Locale;
}) {
  const [range, setRange] = useState<"week" | "month" | "all">("all");
  const [metric, setMetric] = useState<Metric>("frequency");
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const lRef = useRef<LeafletNS | null>(null);
  const layersRef = useRef<LLayer[]>([]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
        style: "currency",
        currency: "RON",
        maximumFractionDigits: 0,
      }),
    [locale]
  );

  const lanes = useMemo(() => {
    const byKey = new Map<string, Lane>();
    for (const o of orders) {
      if (!withinRange(o.dateKey, range)) continue;
      const key = `${o.originCity}→${o.destCity}`;
      const cur =
        byKey.get(key) ??
        { key, originCity: o.originCity, destCity: o.destCity, from: o.from, to: o.to, freq: 0, revenue: 0, profit: 0 };
      cur.freq += 1;
      cur.revenue += o.revenue;
      cur.profit += o.profit;
      byKey.set(key, cur);
    }
    const metricVal = (l: Lane) => (metric === "frequency" ? l.freq : metric === "revenue" ? l.revenue : l.profit);
    return [...byKey.values()].sort((a, b) => metricVal(b) - metricVal(a));
  }, [orders, range, metric]);

  const metricVal = (l: Lane) => (metric === "frequency" ? l.freq : metric === "revenue" ? l.revenue : l.profit);
  const maxAbs = Math.max(1, ...lanes.map((l) => Math.abs(metricVal(l))));

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView(HOME, 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      lRef.current = L;
      setTimeout(() => map.invalidateSize(), 120);
      draw();
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw lanes when the selection changes.
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, metric]);

  function draw() {
    const L = lRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    layersRef.current.forEach((layer) => map.removeLayer(layer));
    layersRef.current = [];

    const bounds: LatLngTuple[] = [];
    const cities = new Map<string, LatLngTuple>();
    for (const lane of lanes) {
      const v = metricVal(lane);
      const norm = Math.abs(v) / maxAbs;
      const weight = 1.5 + norm * 6;
      const negative = metric === "profit" && v < 0;
      const color = negative ? "#e5484d" : "#16a34a";
      const line = L.polyline([lane.from, lane.to], {
        color,
        weight,
        opacity: 0.35 + norm * 0.5,
        lineCap: "round",
      }).addTo(map);
      layersRef.current.push(line);
      cities.set(`${lane.from[0]},${lane.from[1]}`, lane.from);
      cities.set(`${lane.to[0]},${lane.to[1]}`, lane.to);
      bounds.push(lane.from, lane.to);
    }
    for (const [, c] of cities) {
      const dot = L.circleMarker(c, {
        radius: 3.5,
        color: "#1a1d23",
        weight: 1.5,
        fillColor: "#fff",
        fillOpacity: 1,
      }).addTo(map);
      layersRef.current.push(dot);
    }
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  }

  const tabs: { key: Metric; label: string }[] = [
    { key: "frequency", label: t.tabFrequency },
    { key: "revenue", label: t.tabRevenue },
    { key: "profit", label: t.tabProfit },
  ];
  const ranges: { key: "week" | "month" | "all"; label: string }[] = [
    { key: "week", label: t.rangeWeek },
    { key: "month", label: t.rangeMonth },
    { key: "all", label: t.rangeAll },
  ];

  return (
    <section className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{t.title}</h3>
        <div className="flex items-center gap-2">
          <div className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5 text-[13px]">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMetric(tab.key)}
                className={cn(
                  "rounded-md px-3 py-1 font-medium transition-colors",
                  metric === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as "week" | "month" | "all")}
            className="select-native w-40"
          >
            {ranges.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="relative overflow-hidden rounded-lg border">
          <div ref={elRef} style={{ height: 360 }} className="w-full" />
          {lanes.length === 0 && (
            <div className="bg-card/80 pointer-events-none absolute inset-0 grid place-items-center">
              <span className="text-muted-foreground bg-card rounded-lg border px-3 py-1.5 text-sm shadow-sm">
                {t.empty}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border">
          <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-[10px] font-bold tracking-[0.04em] uppercase">
            <span>{t.colLane}</span>
            <span className="text-right">{t.colFreq}</span>
            <span className="text-right">{t.colProfit}</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {lanes.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center text-sm">{t.empty}</p>
            ) : (
              lanes.map((l) => (
                <div key={l.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-3 py-2.5 text-sm last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {l.originCity} → {l.destCity}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {money.format(Math.round(l.revenue / l.freq))} · {t.colAvgRevenue.toLowerCase()}
                    </span>
                  </span>
                  <span className="text-right font-semibold tabular-nums">{l.freq}</span>
                  <span className={cn("text-right font-semibold tabular-nums", l.profit < 0 ? "text-rose-600" : "text-emerald-600")}>
                    {money.format(Math.round(l.profit))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
