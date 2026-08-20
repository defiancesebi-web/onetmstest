"use client";

import { useState } from "react";

export type TabDef = {
  key: string;
  label: string;
  content: React.ReactNode;
  soon?: boolean;
};

/**
 * Underlined tab bar. All panels are rendered (server-side) and hidden except
 * the active one, so switching is instant and needs no refetch. Tabs marked
 * `soon` are visible but not selectable.
 */
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const first = tabs.find((t) => !t.soon) ?? tabs[0];
  const [active, setActive] = useState(first.key);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              disabled={t.soon}
              onClick={() => setActive(t.key)}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                on
                  ? "border-primary text-primary"
                  : t.soon
                    ? "text-muted-foreground/50 cursor-default border-transparent"
                    : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              {t.label}
              {t.soon && (
                <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
                  în curând
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-5">
        {tabs.map((t) => (
          <div key={t.key} hidden={t.key !== active}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
