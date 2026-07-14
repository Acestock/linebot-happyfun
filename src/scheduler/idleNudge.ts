import { prisma } from "../db/prisma";
import { getRedis } from "../redis/client";
import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { pushTextWithLimit } from "../line/push";
import { generateCopy } from "../persona/generator";

const NUDGE_FALLBACKS = [
  "這個群安靜到我以為自己被退群了😳 來，快問快答：今天最想吃什麼？",
  "無聊指數破表🥱 出個題：用一個 emoji 形容你今天的心情，開始！",
  "點名時間📢 最近有什麼好看的劇/影片推薦嗎？我要收集片單！",
];

/** 只在台灣時間 09:00–22:00 主動打擾 */
function isWithinActiveHours(now = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  return hour >= 9 && hour < 22;
}

/**
 * 閒置互動：太久沒人講話的活躍群組，主動丟一個輕鬆話題。
 * 三道閘門：活躍時段、每群組 nudge 冷卻（Redis）、Push 每小時上限。
 */
export async function sweepIdleGroups(): Promise<void> {
  if (!isWithinActiveHours()) return;

  const env = loadEnv();
  const threshold = new Date(Date.now() - env.IDLE_NUDGE_THRESHOLD_MINUTES * 60 * 1000);
  const redis = getRedis();

  const groups = await prisma.group.findMany({
    where: { isActive: true },
    include: {
      members: { orderBy: { lastInteractedAt: "desc" }, take: 1 },
    },
    take: 50,
  });

  for (const group of groups) {
    const lastActivity = group.members[0]?.lastInteractedAt ?? group.joinedAt;
    if (lastActivity > threshold) continue;

    // 有遊戲進行中就不打擾
    if (await redis.exists(`game:active:${group.id}`)) continue;

    // 冷卻：距離上次 nudge 未超過閒置門檻就跳過（避免連續騷擾安靜群組）
    const cooldownKey = `nudge:last:${group.id}`;
    if (await redis.exists(cooldownKey)) continue;

    const fallback = NUDGE_FALLBACKS[Math.floor(Math.random() * NUDGE_FALLBACKS.length)];
    const text = await generateCopy(
      "idle_nudge",
      { 情境: "群組已經安靜好幾個小時", 提示: "丟一個大家容易接話的輕鬆話題" },
      fallback,
      group.id,
    );

    const sent = await pushTextWithLimit(group.lineGroupId, text).catch((err) => {
      logger.warn({ err, groupId: group.id }, "idle nudge push failed");
      return false;
    });

    if (sent) {
      await redis.set(cooldownKey, "1", "EX", env.IDLE_NUDGE_THRESHOLD_MINUTES * 60);
      logger.info({ groupId: group.id }, "idle nudge sent");
    }
  }
}
