"use client";

import { useEffect, useMemo, useRef } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FleetStatus, FleetTruck } from "@/lib/geo/cities";

/**
 * Fleet map — replaces the dashboard's "map coming soon" placeholder and sits
 * above the tracking route rows.
 *
 * Zero npm dependency: Leaflet's CSS + JS are injected from the CDN on mount
 * (client-only, so there is no SSR window issue).
 *
 * Positions are ESTIMATED (interpolated from trip progress along the
 * origin -> destination line, resolved from an offline city gazetteer) — the
 * same estimate the progress bars show, not a real GPS fix. Real-time GPS
 * arrives with the post-beta driver app.
 */

export type { FleetStatus, FleetTruck };

const STATUS_COLOR: Record<FleetStatus, string> = {
  in_transit: "#2563eb", // --primary
  assigned: "#8b5cf6", // --chart-5
  idle: "#64748b", // --muted-foreground
};

// Minimal structural typing for the slice of the Leaflet CDN API we use, so we
// don't need the `leaflet` package or `@types/leaflet` installed.
type LatLngTuple = [number, number];
interface LMap {
  setView(center: LatLngTuple, zoom: number): LMap;
  fitBounds(bounds: LatLngTuple[], opts?: unknown): LMap;
  invalidateSize(): void;
  remove(): void;
}
interface LLayer {
  addTo(map: LMap): LLayer;
  bindPopup(html: string): LLayer;
}
interface LeafletNS {
  map(el: HTMLElement, opts?: unknown): LMap;
  tileLayer(url: string, opts?: unknown): LLayer;
  marker(center: LatLngTuple, opts?: { icon?: unknown }): LLayer;
  polyline(points: LatLngTuple[], opts?: unknown): LLayer;
  circleMarker(center: LatLngTuple, opts?: unknown): LLayer;
  divIcon(opts: unknown): unknown;
}
declare global {
  interface Window {
    L?: LeafletNS;
  }
}

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function loadLeaflet(): Promise<LeafletNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.L) return Promise.resolve(window.L);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L!));
      existing.addEventListener("error", reject);
      if (window.L) resolve(window.L);
      return;
    }
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => resolve(window.L!);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function truckIcon(L: LeafletNS, color: string) {
  const svg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;
  return L.divIcon({
    className: "fleet-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 2px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">${svg}</div>`,
  });
}

// Romania-centred default view for when there is nothing to fit to.
const HOME: [number, number] = [45.9, 25.0];

export function LiveFleetMap({
  trucks = [],
  liveLabel = "camioane",
  emptyLabel = "Nicio cursă activă de afișat pe hartă.",
  legend = { in_transit: "În cursă", assigned: "Alocat", route: "Rută estimată" },
  className,
  height = 340,
}: {
  trucks?: FleetTruck[];
  liveLabel?: string;
  emptyLabel?: string;
  legend?: { in_transit: string; assigned: string; route: string };
  className?: string;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<LeafletNS["map"]> | null>(null);
  const liveCount = useMemo(() => trucks.filter((t) => t.status !== "idle").length, [trucks]);

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

      const bounds: [number, number][] = [];
      trucks.forEach((t) => {
        if (t.route && t.route.length > 1) {
          L.polyline(t.route, { color: "#ef4444", weight: 3, opacity: 0.7, dashArray: "6 6", lineCap: "round" }).addTo(map);
          t.route.forEach((p) => {
            L.circleMarker(p, { radius: 4, color: "#ef4444", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(map);
            bounds.push(p);
          });
        }
        L.marker([t.lat, t.lng], { icon: truckIcon(L, STATUS_COLOR[t.status]) })
          .addTo(map)
          .bindPopup(
            `<div style="font:500 12px/1.4 system-ui,sans-serif"><b>${t.label} · ${t.driver}</b>${
              t.detail ? `<br><span style="color:#64748b">${t.detail}</span>` : ""
            }</div>`,
          );
        bounds.push([t.lat, t.lng]);
      });
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
      setTimeout(() => map.invalidateSize(), 120);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [trucks]);

  return (
    <div className={cn("bg-card relative overflow-hidden rounded-xl border shadow-sm", className)}>
      <div ref={elRef} style={{ height }} className="w-full" />

      {/* live pill */}
      <div className="bg-card/95 absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-sm">
        <Radio className="text-primary size-3.5" />
        <span className="text-xs font-semibold">
          {liveCount} {liveLabel}
        </span>
      </div>

      {/* empty hint */}
      {trucks.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
          <span className="bg-card/95 text-muted-foreground rounded-lg border px-3 py-1.5 text-xs shadow-sm">
            {emptyLabel}
          </span>
        </div>
      )}

      {/* legend */}
      <div className="bg-card/95 text-muted-foreground absolute bottom-3 left-3 z-[500] flex flex-col gap-1 rounded-lg border px-3 py-2 text-[11px] shadow-sm">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR.in_transit }} />
          {legend.in_transit}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR.assigned }} />
          {legend.assigned}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-[3px] w-3.5 rounded-full bg-rose-500" />
          {legend.route}
        </span>
      </div>
    </div>
  );
}
