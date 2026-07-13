import type { webhook } from "@line/bot-sdk";
import { prisma } from "./prisma";

export async function upsertGroupFromEvent(event: webhook.Event) {
  const source = event.source;
  if (!source || source.type !== "group") return null;

  return prisma.group.upsert({
    where: { lineGroupId: source.groupId },
    create: { lineGroupId: source.groupId },
    update: {},
  });
}

export async function upsertMemberFromEvent(event: webhook.Event, groupId: string) {
  const source = event.source;
  if (!source || source.type !== "group" || !source.userId) return null;

  const isMessage = event.type === "message";

  return prisma.groupMember.upsert({
    where: { groupId_lineUserId: { groupId, lineUserId: source.userId } },
    create: { groupId, lineUserId: source.userId, messageCount: isMessage ? 1 : 0 },
    update: {
      lastInteractedAt: new Date(),
      ...(isMessage ? { messageCount: { increment: 1 } } : {}),
    },
  });
}
