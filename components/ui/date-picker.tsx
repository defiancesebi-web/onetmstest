"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Visual date picker: a calendar popover that produces a `YYYY-MM-DD` string,
 * a drop-in for the old native <input type="date">. Pure date math (local
 * calendar days, no timezone shift), no external library.
 *
 * Works controlled (`value` + `onChange`, matching the form's existing state)
 * or uncontrolled (`defaultValue`). When `name` is given it also renders a
 * hidden input so plain <form> submission carries the value; where the value is
 * serialized elsewhere (e.g. an order's stops JSON) omit `name`.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseKey(s?: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DatePicker({
  name,
  value: valueProp,
  onChange,
  defaultValue,
  locale = "ro-RO",
  placeholder = "Alege data",
  id,
  className,
}: {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string | null;
  locale?: string;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const value = isControlled ? (valueProp ?? "") : internal;
  const setValue = (v: string) => {
    if (!isControlled) setInternal(v);
    onChange?.(v);
  };

  const [open, setOpen] = useState(false);
  const selected = parseKey(value);
  const [view, setView] = useState(() => {
    const base = parseKey(value) ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  // Re-centre the calendar on the value whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    const base = parseKey(value) ?? new Date();
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const monthFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  const valueFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }), [locale]);
  const weekdayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);

  // Weekday headers Mon..Sun (2024-01-01 was a Monday).
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(2024, 0, 1 + i)));

  const gridStart = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Mon = 0
    const s = new Date(first);
    s.setDate(first.getDate() - offset);
    return s;
  }, [view]);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const todayKey = toKey(new Date());
  const monthLabel = monthFmt.format(view);
  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  function pick(d: Date) {
    setValue(toKey(d));
    setOpen(false);
  }
  function shiftMonth(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className="relative" ref={ref}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border-input bg-card flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? valueFmt.format(selected) : placeholder}
        </span>
        <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
      </button>

      {open && (
        <div className="bg-card absolute left-0 top-full z-50 mt-1 w-[280px] rounded-lg border p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="hover:bg-muted grid size-7 place-items-center rounded-md" aria-label="Luna anterioară">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">{monthTitle}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="hover:bg-muted grid size-7 place-items-center rounded-md" aria-label="Luna următoare">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {weekdays.map((w, i) => (
              <div key={i} className="text-muted-foreground py-1 text-center text-[11px] font-medium capitalize">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const key = toKey(d);
              const inMonth = d.getMonth() === view.getMonth();
              const isSelected = key === value;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "grid size-8 place-items-center rounded-md text-[13px] tabular-nums transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : inMonth
                        ? "hover:bg-muted text-foreground"
                        : "text-muted-foreground/50 hover:bg-muted",
                    !isSelected && isToday && "ring-primary/40 font-semibold ring-1"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
