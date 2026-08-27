/**
 * Central-design StatCard. Adds an optional trend delta and a hover lift; same
 * props as before so existing call sites keep working.
 */
export function StatCard({
  icon,
  label,
  value,
  sub,
  delta,
  tone = "bg-primary/10 text-primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  /** e.g. "+12%" (green) or "-4%" (red). */
  delta?: string;
  tone?: string;
}) {
  const deltaUp = delta?.trim().startsWith("+");
  return (
    <div className="bg-card rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}>{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
        {delta && (
          <span
            className={`text-xs font-semibold ${deltaUp ? "text-emerald-600" : "text-rose-600"}`}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
    </div>
  );
}
