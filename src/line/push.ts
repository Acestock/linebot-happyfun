import type { messagingApi } from "@line/bot-sdk";
import { loadEnv } from "../config/env";
import { getRedis } from "../redis/client";
import { getLineClient } from "./client";
import { withPartyQuickReply, withQuickReply } from "./quickReply";
import { logger } from "../utils/logger";

/**
 * 有頻率上限的主動推播（Push Message 依用量計費）。
 * 每群組每小時最多 PUSH_RATE_LIMIT_PER_GROUP_PER_HOUR 則，超過就靜默跳過。
 * 回傳是否真的送出。這個上限是整個群組共用的一個額度（不分文字或 Flex 卡片、
 * 不分哪個功能觸發），故意設計成這樣才能真的控制成本/騷擾程度。
 */
async function consumeRateLimit(lineGroupId: string): Promise<boolean> {
  const env = loadEnv();
  const hourBucket = new Date().toISOString().slice(0, 13); // e.g. 2026-07-14T09
  const key = `push:${lineGroupId}:${hourBucket}`;

  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 3700);
  }

  if (count > env.PUSH_RATE_LIMIT_PER_GROUP_PER_HOUR) {
    logger.info({ lineGroupId, count }, "push skipped: hourly rate limit reached");
    return false;
  }
  return true;
}

/**
 * 跟 pushTextWithLimit 共用同一個頻率限制，但可以送任意訊息（例如 Flex 卡片），
 * 不限於純文字。
 *
 * 預設附上 party Quick Reply；小聚進行中時 party 選單是暫停的，呼叫端可以傳入
 * 自己的 quickReply（例如小聚的主持面板按鈕）蓋掉預設值。
 */
export async function pushMessagesWithLimit(
  lineGroupId: string,
  baseMessages: messagingApi.Message[],
  quickReply?: messagingApi.QuickReply,
): Promise<boolean> {
  if (!(await consumeRateLimit(lineGroupId))) return false;

  const messages = quickReply ? withQuickReply(baseMessages, quickReply) : withPartyQuickReply(baseMessages);
  await getLineClient().pushMessage({ to: lineGroupId, messages });
  return true;
}

export async function pushTextWithLimit(
  lineGroupId: string,
  text: string,
  quickReply?: messagingApi.QuickReply,
): Promise<boolean> {
  return pushMessagesWithLimit(lineGroupId, [{ type: "text", text }], quickReply);
}
