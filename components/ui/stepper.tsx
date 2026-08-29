import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wizard step indicator (STEP 1 → STEP 2). Numbered circles + labels with a
 * connecting line; the current step is green, done steps show a check.
 */
export function Stepper({
  steps,
  current,
  stepWord,
  className,
}: {
  steps: string[];
  /** 1-based index of the active step. */
  current: number;
  stepWord: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        const last = i === steps.length - 1;
        return (
          <div key={n} className={cn("flex items-center", !last && "flex-1")}>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="size-4" /> : n}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-muted-foreground text-[10px] font-bold tracking-[0.06em] uppercase">
                  {stepWord} {n}
                </span>
                <span className={cn("text-sm", active ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
            </div>
            {!last && <div className={cn("mx-4 h-px flex-1", done ? "bg-primary/40" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}
