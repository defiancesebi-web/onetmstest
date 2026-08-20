export type AreaPoint = { label: string; total: number; delivered: number };

/**
 * Pure-SVG area + line chart for the 7-day loads overview. The filled area is
 * total loads; the line is delivered. Scales to a fixed viewBox and stretches
 * to its container width. No chart library.
 */
export function AreaChart({ points }: { points: AreaPoint[] }) {
  const w = 640;
  const h = 200;
  const padX = 14;
  const padTop = 14;
  const padBottom = 26;
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.total));

  const x = (i: number) => padX + (i * (w - 2 * padX)) / Math.max(1, n - 1);
  const y = (v: number) => padTop + (1 - v / max) * (h - padTop - padBottom);

  const line = (key: "total" | "delivered") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");
  const area =
    `${line("total")} L ${x(n - 1)} ${h - padBottom} L ${x(0)} ${h - padBottom} Z`;

  const gridYs = [0, 0.5, 1].map((t) => padTop + t * (h - padTop - padBottom));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridYs.map((gy, i) => (
        <line key={i} x1={padX} y1={gy} x2={w - padX} y2={gy} stroke="var(--color-border)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#areaFill)" />
      <path d={line("total")} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={line("delivered")} fill="none" stroke="var(--color-chart-2)" strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.total)} r="3" fill="var(--color-primary)" />
      ))}
      {points.map((p, i) => (
        <text key={i} x={x(i)} y={h - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {p.label}
        </text>
      ))}
    </svg>
  );
}
