import { prisma } from "../db/prisma";
import { getRedis } from "../redis/client";
import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { pushTextWithLimit } from "../line/push";

/**
 * 逾時掃描：DB 裡還是 active、但 Redis 即時狀態已過期消失的 session，
 * 代表玩家棄坑 → 標記 timeout，並（受頻率上限保護地）公告收攤。
 */
export async function sweepTimedOutGames(): Promise<void> {
  const env = loadEnv();
  const cutoff = new Date(Date.now() - env.GAME_TIMEOUT_MINUTES * 60 * 1000);

  const staleSessions = await prisma.gameSession.findMany({
    where: { status: "active", startedAt: { lt: cutoff } },
    include: { group: true },
    take: 20,
  });

  for (const session of staleSessions) {
    const hasLiveState = await getRedis().exists(`game:active:${session.groupId}`);
    if (hasLiveState) continue; // 還有人在玩（每次互動都會刷新 TTL）

    await prisma.gameSession.update({
      where: { id: session.id },
      data: { status: "timeout", endedAt: new Date() },
    });
    logger.info({ sessionId: session.id, gameType: session.gameType }, "game session timed out");

    if (session.group.isActive) {
      await pushTextWithLimit(
        session.group.lineGroupId,
        "剛剛那局沒人理我，先收攤囉😴 想繼續玩隨時輸入 party！",
      ).catch((err) => logger.warn({ err }, "timeout announce push failed"));
    }
  }
}
