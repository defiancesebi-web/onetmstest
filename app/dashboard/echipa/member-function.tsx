"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { setMemberJobTitleAction, type JobTitleState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Owner-only inline editor for a member's function/title. */
export function MemberFunction({
  userId,
  jobTitle,
  labels,
}: {
  userId: string;
  jobTitle: string | null;
  labels: { placeholder: string; save: string };
}) {
  const bound = setMemberJobTitleAction.bind(null, userId);
  const [state, action, pending] = useActionState<JobTitleState, FormData>(bound, {
    error: null,
    saved: false,
  });
  const [value, setValue] = useState(jobTitle ?? "");

  return (
    <form action={action} className="flex items-center gap-1.5">
      <Input
        name="jobTitle"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={labels.placeholder}
        className="h-9 max-w-[220px]"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {labels.save}
      </Button>
      {state.saved && !state.error && <CheckCircle2 className="size-4 text-emerald-600" />}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
