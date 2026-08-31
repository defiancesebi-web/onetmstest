"use server";

import { auth } from "@/auth";
import { getConversation, sendMessage, type ChatMessage } from "@/lib/data/messages";

async function ctx() {
  const s = await auth();
  if (!s?.user.companyId) throw new Error("Neautentificat");
  return {
    session: { role: s.user.role, companyId: s.user.companyId },
    companyId: s.user.companyId,
    name: s.user.name ?? null,
  };
}

export async function loadConversationAction(driverId: string): Promise<ChatMessage[]> {
  const { session, companyId } = await ctx();
  return getConversation(session, companyId, driverId);
}

export async function sendMessageAction(driverId: string, body: string): Promise<ChatMessage> {
  const { session, companyId, name } = await ctx();
  return sendMessage(session, companyId, driverId, body, name);
}
