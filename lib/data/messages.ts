import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * Internal dispatcher ↔ driver chat. Drivers can't send yet (no driver app),
 * so today every message is dispatcher → driver, stored for delivery once the
 * mobile app ships. Everything is scoped to the session's company.
 */

export type ChatDriver = {
  id: string;
  name: string;
  lastBody: string | null;
  lastAt: string | null;
};

export type ChatMessage = {
  id: string;
  fromDriver: boolean;
  body: string;
  senderName: string | null;
  createdAt: string;
};

export async function listChatDrivers(session: SessionUser, companyId: string): Promise<ChatDriver[]> {
  assertCompanyAccess(session, companyId);
  const drivers = await prisma.driver.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      messages: { take: 1, orderBy: { createdAt: "desc" }, select: { body: true, createdAt: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return drivers.map((d) => ({
    id: d.id,
    name: `${d.lastName} ${d.firstName}`.trim(),
    lastBody: d.messages[0]?.body ?? null,
    lastAt: d.messages[0]?.createdAt.toISOString() ?? null,
  }));
}

export async function getConversation(
  session: SessionUser,
  companyId: string,
  driverId: string
): Promise<ChatMessage[]> {
  assertCompanyAccess(session, companyId);
  const messages = await prisma.message.findMany({
    where: { companyId, driverId },
    orderBy: { createdAt: "asc" },
  });
  return messages.map((m) => ({
    id: m.id,
    fromDriver: m.fromDriver,
    body: m.body,
    senderName: m.senderName,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendMessage(
  session: SessionUser,
  companyId: string,
  driverId: string,
  body: string,
  senderName: string | null
): Promise<ChatMessage> {
  assertCompanyAccess(session, companyId);
  const text = body.trim();
  if (!text) throw new Error("Mesajul este gol.");
  if (text.length > 2000) throw new Error("Mesajul este prea lung.");

  // Make sure the driver belongs to this company before writing.
  const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId }, select: { id: true } });
  if (!driver) throw new Error("Șoferul nu a fost găsit.");

  const m = await prisma.message.create({
    data: { companyId, driverId, fromDriver: false, body: text, senderName },
  });
  return {
    id: m.id,
    fromDriver: m.fromDriver,
    body: m.body,
    senderName: m.senderName,
    createdAt: m.createdAt.toISOString(),
  };
}
