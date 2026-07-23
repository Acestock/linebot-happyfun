import type { webhook } from "@line/bot-sdk";
import { prisma } from "./prisma";
import { getLineClient } from "../line/client";
import { logger } from "../utils/logger";

/**
 * 真正的 LINE 群組 ID 格式：C 開頭接 32 位英數字（沒有連字號）。LIFF 呼叫 API 時帶來的
 * groupId 如果不符合這個格式（例如誤用了我們自己資料庫的 UUID），代表不是合法的 LINE
 * 群組 ID——呼叫端要擋下來，不要讓它悄悄建立一筆「影子群組」污染資料、導致排行榜等
 * 依 groupId 查詢的功能對不上。
 */
export function isValidLineGroupId(value: string): boolean {
  return /^C[0-9a-f]{32}$/i.test(value);
}

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

/**
 * 給 LIFF API 用：跟 upsertGroupFromEvent/upsertMemberFromEvent 同樣的懶惰建立邏輯，
 * 差別是輸入來源不是 webhook event，而是 LIFF 那邊驗證過的 lineUserId + liff.getContext()
 * 拿到的 lineGroupId。不動 messageCount（那是聊天訊息量的統計，LIFF 互動不算）。
 */
export async function upsertGroupMemberByLineIds(lineGroupId: string, lineUserId: string) {
  const group = await prisma.group.upsert({
    where: { lineGroupId },
    create: { lineGroupId },
    update: {},
  });

  const member = await prisma.groupMember.upsert({
    where: { groupId_lineUserId: { groupId: group.id, lineUserId } },
    create: { groupId: group.id, lineUserId },
    update: { lastInteractedAt: new Date() },
  });

  if (!member.displayName) {
    void fetchAndStoreDisplayName(member.id, lineGroupId, lineUserId);
  }

  return { group, member };
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
    logger.warn({ err, lineUserId, lineGroupId }, "could not fetch group member profile");
  }
}
