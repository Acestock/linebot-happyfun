import { MeetupPhase } from "@prisma/client";
import { prisma } from "../db/prisma";
import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { pushTextWithLimit } from "../line/push";

/**
 * 小聚是付費功能，跟遊戲不一樣的地方是它會整個暫停群組的 party/遊戲系統，
 * 所以主辦人忘記結束比遊戲逾時嚴重得多——會讓群組卡住。這是可靠度保險絲，
 * 不是行銷性質的主動搭話，預設開啟（見 src/config/env.ts）。
 *
 * lastActivityAt 是 Meetup 的 @updatedAt 欄位，主辦人下任何指令都會刷新；
 * 逾時只看「主辦人多久沒動作」，不受參加者聊天量影響（那些本來就不觸發回覆）。
 */
export async function sweepIdleMeetups(): Promise<void> {
  const env = loadEnv();
  if (!env.MEETUP_IDLE_TIMEOUT_ENABLED) return;

  const cutoff = new Date(Date.now() - env.MEETUP_IDLE_TIMEOUT_MINUTES * 60 * 1000);

  const staleMeetups = await prisma.meetup.findMany({
    where: {
      phase: { notIn: [MeetupPhase.ENDED, MeetupPhase.CANCELLED] },
      lastActivityAt: { lt: cutoff },
    },
    include: { group: true },
    take: 20,
  });

  for (const meetup of staleMeetups) {
    await prisma.meetup.update({
      where: { id: meetup.id },
      data: { phase: MeetupPhase.CANCELLED, endedAt: new Date() },
    });
    logger.info({ meetupId: meetup.id, phase: meetup.phase }, "meetup auto-cancelled after being idle");

    if (meetup.group.isActive) {
      await pushTextWithLimit(
        meetup.group.lineGroupId,
        `「${meetup.name ?? "小聚"}」已經有一段時間沒有主持人操作，先自動收攤囉～輸入「建立小聚」可以開新的一場！🎪`,
      ).catch((err) => logger.warn({ err }, "meetup timeout announce push failed"));
    }
  }
}
