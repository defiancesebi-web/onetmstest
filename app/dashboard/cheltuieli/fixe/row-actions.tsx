"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { setFixedCostActiveAction, deleteFixedCostAction } from "../actions";
import { Button } from "@/components/ui/button";

export function FixedCostRowActions({
  id,
  isActive,
  labels,
}: {
  id: string;
  isActive: boolean;
  labels: { activate: string; deactivate: string; delete: string; confirmDelete: string };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const r = await setFixedCostActiveAction(id, !isActive);
      if (r.error) setError(r.error);
    });
  }
  function remove() {
    if (!window.confirm(labels.confirmDelete)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteFixedCostAction(id);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={toggle}>
        {isActive ? labels.deactivate : labels.activate}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={remove}
        aria-label={labels.delete}
      >
        <Trash2 className="size-4 text-rose-500" />
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
