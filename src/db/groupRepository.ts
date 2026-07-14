import type { webhook } from "@line/bot-sdk";
import { prisma } from "./prisma";
import { getLineClient } from "../line/client";
import { logger } from "../utils/logger";

export async function upsertGroupFromEvent(event: webhook.Event) {
  const source = event.source;
  if (!source || source.type !== "group") return null;

  return prisma.group.upsert({
    where: { lineGroupId: source.groupId },
    create: { lineGroupId: source.groupId },
    // 重新被拉回群組時恢復活躍狀態
    update: event.type === "join" ? { isActive: true } : {},
  });
}

export async function upsertMemberFromEvent(event: webhook.Event, groupId: string) {
  const source = event.source;
  if (!source || source.type !== "group" || !source.userId) return null;

  const isMessage = event.type === "message";

  const member = await prisma.groupMember.upsert({
    where: { groupId_lineUserId: { groupId, lineUserId: source.userId } },
    create: { groupId, lineUserId: source.userId, messageCount: isMessage ? 1 : 0 },
    update: {
      lastInteractedAt: new Date(),
      ...(isMessage ? { messageCount: { increment: 1 } } : {}),
    },
  });

  if (!member.displayName) {
    void fetchAndStoreDisplayName(member.id, source.groupId, source.userId);
  }

  return member;
}

/** 補抓成員顯示名稱（best-effort，失敗不影響主流程） */
async function fetchAndStoreDisplayName(
  memberId: string,
  lineGroupId: string,
  lineUserId: string,
): Promise<void> {
  try {
    const profile = await getLineClient().getGroupMemberProfile(lineGroupId, lineUserId);
    await prisma.groupMember.update({
      where: { id: memberId },
      data: { displayName: profile.displayName },
    });
  } catch (err) {
    logger.warn({ err, lineUserId }, "could not fetch group member profile");
  }
}
