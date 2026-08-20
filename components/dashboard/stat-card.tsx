export function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "bg-primary/10 text-primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
    </div>
  );
}
