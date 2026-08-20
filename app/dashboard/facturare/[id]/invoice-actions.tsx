"use client";

import { useState, useTransition } from "react";
import { Printer, Send } from "lucide-react";
import {
  issueInvoiceAction,
  markPaidAction,
  cancelInvoiceAction,
  deleteDraftAction,
} from "../actions";
import type { Dictionary } from "@/lib/i18n";
import type { InvoiceStatus } from "@/lib/generated/prisma/enums";
import { Button } from "@/components/ui/button";

export function InvoiceActions({
  invoiceId,
  status,
  t,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  t: Dictionary["invoiceView"];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" />
          {t.print}
        </Button>

        {status === "DRAFT" && (
          <>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => run(() => issueInvoiceAction(invoiceId), t.confirmIssue)}
            >
              {t.issue}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteDraftAction(invoiceId), t.confirmDelete)}
            >
              {t.deleteDraft}
            </Button>
          </>
        )}

        {status === "ISSUED" && (
          <>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => run(() => markPaidAction(invoiceId))}
            >
              {t.markPaid}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => cancelInvoiceAction(invoiceId), t.confirmCancel)}
            >
              {t.cancel}
            </Button>
          </>
        )}

        {status !== "DRAFT" && status !== "CANCELLED" && (
          <Button type="button" size="sm" variant="outline" disabled title={t.efacturaSoon}>
            <Send className="size-4" />
            {t.efacturaSend}
          </Button>
        )}
      </div>

      {status !== "DRAFT" && status !== "CANCELLED" && (
        <p className="text-muted-foreground mt-2 text-xs">{t.efacturaSoon}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
