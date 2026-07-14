import { getRedis } from "../../redis/client";
import { logger } from "../../utils/logger";

const MAX_REMEMBERED = 40;
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天：夠久到不會短期內重複，也不會無限累積

const key = (groupId: string, gameType: string) => `questions:asked:${gameType}:${groupId}`;

/** 取這個群組這款遊戲最近出過的題目（用來提醒 LLM 不要重複） */
export async function getRecentQuestions(groupId: string, gameType: string): Promise<string[]> {
  try {
    return await getRedis().lrange(key(groupId, gameType), 0, MAX_REMEMBERED - 1);
  } catch (err) {
    logger.warn({ err, groupId, gameType }, "failed to read question history");
    return [];
  }
}

/** 記錄這次用掉的題目，超過上限自動裁掉舊的 */
export async function recordQuestions(
  groupId: string,
  gameType: string,
  questions: string[],
): Promise<void> {
  if (questions.length === 0) return;
  try {
    const redis = getRedis();
    const k = key(groupId, gameType);
    await redis.lpush(k, ...questions);
    await redis.ltrim(k, 0, MAX_REMEMBERED - 1);
    await redis.expire(k, TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, groupId, gameType }, "failed to record question history");
  }
}
