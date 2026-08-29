"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Searchable single-select. A drop-in for a native <select> on long lists
 * (clients, drivers): a popover with a search box + a scrollable option list,
 * optional per-option avatar (initials). Controlled via `value`/`onChange`;
 * writes a hidden input when `name` is given so plain <form> submit carries it.
 * No external library.
 */

export type ComboOption = { value: string; label: string; sublabel?: string };

function initials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Combobox({
  name,
  value,
  onChange,
  options,
  placeholder = "Selectează…",
  searchPlaceholder = "Caută…",
  emptyText = "Niciun rezultat",
  noneLabel,
  showAvatars = false,
  id,
  className,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** When set, a row at the top clears the selection (value ""). */
  noneLabel?: string;
  showAvatars?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  const Avatar = ({ label }: { label: string }) => (
    <span className="bg-primary/10 text-primary grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold">
      {initials(label) || "—"}
    </span>
  );

  return (
    <div className="relative" ref={ref}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border-input bg-card flex h-10 w-full min-w-0 items-center gap-2 rounded-md border px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {selected ? (
          <>
            {showAvatars && <Avatar label={selected.label} />}
            <span className="text-foreground min-w-0 flex-1 truncate text-left">{selected.label}</span>
          </>
        ) : (
          <span className="text-muted-foreground flex-1 truncate text-left">{placeholder}</span>
        )}
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </button>

      {open && (
        <div className="bg-card absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-lg border shadow-lg">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {noneLabel !== undefined && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  <span className="text-muted-foreground flex-1 truncate">{noneLabel}</span>
                  {value === "" && <Check className="text-primary size-4 shrink-0" />}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="text-muted-foreground px-3 py-4 text-center text-sm">{emptyText}</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => pick(o.value)}
                    className="hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm"
                  >
                    {showAvatars && <Avatar label={o.label} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o.label}</span>
                      {o.sublabel && (
                        <span className="text-muted-foreground block truncate text-xs">{o.sublabel}</span>
                      )}
                    </span>
                    {o.value === value && <Check className="text-primary size-4 shrink-0" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
