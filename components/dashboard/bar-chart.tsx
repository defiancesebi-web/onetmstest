export type BarPoint = { label: string; value: number };

/**
 * Pure-SVG vertical bar chart for the monthly revenue report. Bars scale to the
 * tallest value; an empty series renders a flat baseline. No chart library.
 */
export function BarChart({ points, format }: { points: BarPoint[]; format: (n: number) => string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;

  return (
    <div className="flex h-full items-end gap-2">
      {points.map((p, i) => {
        const pct = (p.value / max) * 100;
        return (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {p.value > 0 ? format(p.value) : ""}
            </span>
            <div
              className="bg-primary/80 hover:bg-primary w-full rounded-t transition-colors"
              style={{ height: `${Math.max(pct, p.value > 0 ? 4 : 0)}%` }}
              title={`${p.label}: ${format(p.value)}`}
            />
            <span className="text-muted-foreground text-[11px]">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}
