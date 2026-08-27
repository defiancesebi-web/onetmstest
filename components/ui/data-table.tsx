import Link from "next/link";
import { cn } from "@/lib/utils";
import { ClickableRow } from "@/components/ui/clickable-row";

/**
 * Central design primitives for ONE TMS list & detail screens.
 * One source of truth for the card + table look — every list page (comenzi,
 * clienti, soferi, facturare…) renders through these instead of hand-rolling
 * `overflow-x-auto rounded-lg border` + `bg-muted/50` tables.
 *
 * These are Server Components: the column `cell` renderers and `onRowHref` are
 * invoked here, on the server, so pages can keep passing plain functions (React
 * forbids passing functions across the server → client boundary). Only the
 * clickable-row behaviour lives in a small client component.
 *
 * Tailwind v4 tokens only (bg-card, text-muted-foreground, border, primary).
 * No new deps.
 */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm", className)}>{children}</div>
  );
}

export function SectionCard({
  title,
  right,
  bodyClassName,
  className,
  children,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-4 border-b px-5 py-3.5">
          {typeof title === "string" ? (
            <h3 className="text-muted-foreground text-[11px] font-bold tracking-[0.07em] uppercase">
              {title}
            </h3>
          ) : (
            title
          )}
          {right}
        </div>
      )}
      <div className={bodyClassName ?? "p-5"}>{children}</div>
    </Card>
  );
}

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right";
  /** Cell renderer. Invoked server-side. */
  cell: (row: T) => React.ReactNode;
  className?: string;
};

/**
 * Polished data table matching the mockups: uppercase muted headers, generous
 * padding, hover rows, tabular numerics on right-aligned columns. Wrapped in a
 * Card so it drops straight into a page.
 *
 * Rows can be made clickable via `onRowHref` (client-side Next navigation, no
 * full reload). The first cell should still hold a real <Link> so keyboard
 * users and "open in new tab" keep working.
 */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  onRowHref,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  /** Optional: make the whole row a link target (cursor + hover). */
  onRowHref?: (row: T) => string | undefined;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <Card className="text-muted-foreground border-dashed p-8 text-center text-sm">
        {empty ?? "Nu există înregistrări."}
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "text-muted-foreground px-5 py-3 text-[11px] font-bold tracking-[0.05em] uppercase",
                    c.align === "right" ? "text-right" : "text-left",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = onRowHref?.(row);
              const cells = columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-5 py-3",
                    c.align === "right" ? "text-right tabular-nums" : "text-left",
                  )}
                >
                  {c.cell(row)}
                </td>
              ));
              const rowClass = cn(
                "border-b transition-colors last:border-0",
                href ? "hover:bg-muted/40 cursor-pointer" : "hover:bg-muted/25",
              );
              return href ? (
                <ClickableRow key={getKey(row)} href={href} className={rowClass}>
                  {cells}
                </ClickableRow>
              ) : (
                <tr key={getKey(row)} className={rowClass}>
                  {cells}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Toolbar shell for the search + filter row above a table. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

/** Pill-style filter tabs. Marks the active value. */
export function FilterTabs({
  options,
  active,
  hrefFor,
}: {
  options: { value: string; label: string }[];
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === active;
        return (
          <Link
            key={o.value}
            href={hrefFor(o.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              on
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:border-muted-foreground/40",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
