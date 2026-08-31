"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Truck, User, Building2, ImageOff } from "lucide-react";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { formatDateKey, type DocumentStatus } from "@/lib/documentStatus";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DocRow = {
  id: string;
  typeLabel: string;
  number: string | null;
  expiresKey: string;
  status: DocumentStatus;
  ownerKind: "vehicle" | "driver" | "company";
  ownerLabel: string;
  ownerHref: string | null;
  imageData: string | null;
};

export type DocsPageLabels = {
  searchPlaceholder: string;
  allStatuses: string;
  statusExpired: string;
  statusExpiring: string;
  statusValid: string;
  colPhoto: string;
  colType: string;
  colOwner: string;
  colNumber: string;
  colExpires: string;
  empty: string;
  showing: string;
};

export function DocumentsList({
  rows,
  t,
  locale,
}: {
  rows: DocRow[];
  t: DocsPageLabels;
  locale: Locale;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const [viewing, setViewing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (q) {
        const hay = `${r.typeLabel} ${r.ownerLabel} ${r.number ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status]);

  const tabs: { key: DocumentStatus | ""; label: string }[] = [
    { key: "", label: t.allStatuses },
    { key: "EXPIRED", label: t.statusExpired },
    { key: "EXPIRING_SOON", label: t.statusExpiring },
    { key: "VALID", label: t.statusValid },
  ];

  const OwnerIcon = ({ kind }: { kind: DocRow["ownerKind"] }) =>
    kind === "vehicle" ? (
      <Truck className="size-3.5" />
    ) : kind === "driver" ? (
      <User className="size-3.5" />
    ) : (
      <Building2 className="size-3.5" />
    );

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
        <span className="text-muted-foreground text-sm tabular-nums">
          {t.showing.replace("{n}", String(filtered.length))}
        </span>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              status === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:border-muted-foreground/40"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-[11px] font-bold tracking-[0.04em] uppercase">
                  <th className="px-4 py-2.5">{t.colPhoto}</th>
                  <th className="px-4 py-2.5">{t.colType}</th>
                  <th className="px-4 py-2.5">{t.colOwner}</th>
                  <th className="px-4 py-2.5">{t.colNumber}</th>
                  <th className="px-4 py-2.5">{t.colExpires}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      {r.imageData ? (
                        <button type="button" onClick={() => setViewing(r.imageData)} aria-label={t.colPhoto}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.imageData} alt="" className="h-10 w-14 rounded border object-cover" />
                        </button>
                      ) : (
                        <span className="bg-muted text-muted-foreground grid h-10 w-14 place-items-center rounded border">
                          <ImageOff className="size-4" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{r.typeLabel}</td>
                    <td className="px-4 py-2">
                      <span className="text-muted-foreground inline-flex items-center gap-1.5">
                        <OwnerIcon kind={r.ownerKind} />
                        {r.ownerHref ? (
                          <Link href={r.ownerHref} className="text-primary hover:underline">
                            {r.ownerLabel}
                          </Link>
                        ) : (
                          r.ownerLabel
                        )}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-2">{r.number ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{formatDateKey(r.expiresKey)}</td>
                    <td className="px-4 py-2">
                      <DocumentStatusBadge status={r.status} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setViewing(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
