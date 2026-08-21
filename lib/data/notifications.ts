import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { getExpiringDocuments } from "@/lib/data/documents";
import { todayKeyInBucharest } from "@/lib/documentStatus";

/**
 * Derived notifications: not a log of past events, but the things that need
 * action right now, computed live from the data. No stored read/unread state —
 * an item disappears when the underlying issue is resolved, which is exactly
 * what a dispatcher/owner wants from the bell.
 */

export type NotificationKind =
  | "docsExpired"
  | "docsExpiring"
  | "invoicesOverdue"
  | "invoicesDueSoon"
  | "ordersToInvoice";

export type NotificationSeverity = "critical" | "warning" | "info";

export type NotificationRaw = {
  kind: NotificationKind;
  severity: NotificationSeverity;
  count: number;
  /** RON, for the invoice items. */
  amount?: number;
  href: string;
};

export async function getNotifications(
  session: SessionUser,
  companyId: string
): Promise<NotificationRaw[]> {
  assertCompanyAccess(session, companyId);

  const todayKey = todayKeyInBucharest();
  const today = new Date(`${todayKey}T00:00:00Z`);
  const in7 = new Date(today);
  in7.setUTCDate(in7.getUTCDate() + 7);

  const [docs, overdue, dueSoon, toInvoice] = await Promise.all([
    getExpiringDocuments(session, companyId),
    prisma.invoice.aggregate({
      where: { companyId, status: "ISSUED", dueDate: { lt: today } },
      _count: true,
      _sum: { grossTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, status: "ISSUED", dueDate: { gte: today, lte: in7 } },
      _count: true,
      _sum: { grossTotal: true },
    }),
    prisma.order.count({
      where: {
        companyId,
        status: { in: ["DELIVERED", "DOCUMENTS_RECEIVED"] },
        invoices: { none: { status: { in: ["ISSUED", "PAID"] } } },
      },
    }),
  ]);

  const expired = docs.filter((d) => d.status === "EXPIRED").length;
  const expiring = docs.filter((d) => d.status === "EXPIRING_SOON").length;

  const items: NotificationRaw[] = [];
  if (expired > 0) {
    items.push({ kind: "docsExpired", severity: "critical", count: expired, href: "/dashboard" });
  }
  if (overdue._count > 0) {
    items.push({
      kind: "invoicesOverdue",
      severity: "critical",
      count: overdue._count,
      amount: Number(overdue._sum?.grossTotal ?? 0),
      href: "/dashboard/facturare?status=ISSUED",
    });
  }
  if (expiring > 0) {
    items.push({ kind: "docsExpiring", severity: "warning", count: expiring, href: "/dashboard" });
  }
  if (dueSoon._count > 0) {
    items.push({
      kind: "invoicesDueSoon",
      severity: "warning",
      count: dueSoon._count,
      amount: Number(dueSoon._sum?.grossTotal ?? 0),
      href: "/dashboard/facturare?status=ISSUED",
    });
  }
  if (toInvoice > 0) {
    items.push({
      kind: "ordersToInvoice",
      severity: "info",
      count: toInvoice,
      href: "/dashboard/comenzi",
    });
  }

  return items;
}
