"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteExpenseAction } from "../actions";
import { Button } from "@/components/ui/button";

export function ExpenseDeleteButton({
  id,
  labels,
}: {
  id: string;
  labels: { delete: string; confirmDelete: string };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm(labels.confirmDelete)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteExpenseAction(id);
      if (r.error) setError(r.error);
    });
  }

  return (
    <>
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
    </>
  );
}
