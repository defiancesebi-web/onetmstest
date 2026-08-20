export type DonutSegment = { label: string; value: number; color: string };

/**
 * Pure-SVG donut. Segments are drawn as dash-array arcs on stacked circles,
 * rotated so the first slice starts at 12 o'clock. No chart library.
 */
export function DonutChart({
  segments,
  size = 168,
  thickness = 24,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((seg) => {
            const len = (seg.value / total) * c;
            const el = (
              <circle
                key={seg.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return el;
          })}
      </g>
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-foreground text-[22px] font-bold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {centerValue}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" className="fill-muted-foreground text-[11px]">
        {centerLabel}
      </text>
    </svg>
  );
}
