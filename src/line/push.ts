import { loadEnv } from "../config/env";
import { getRedis } from "../redis/client";
import { getLineClient } from "./client";
import { withPartyQuickReply } from "./quickReply";
import { logger } from "../utils/logger";

/**
 * 有頻率上限的主動推播（Push Message 依用量計費）。
 * 每群組每小時最多 PUSH_RATE_LIMIT_PER_GROUP_PER_HOUR 則，超過就靜默跳過。
 * 回傳是否真的送出。
 */
export async function pushTextWithLimit(lineGroupId: string, text: string): Promise<boolean> {
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

  await getLineClient().pushMessage({
    to: lineGroupId,
    messages: withPartyQuickReply([{ type: "text", text }]),
  });
  return true;
}
