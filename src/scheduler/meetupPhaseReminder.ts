import { prisma } from "../db/prisma";
import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { pushTextWithLimit } from "../line/push";
import { buildMeetupQuickReply } from "../line/meetupQuickReply";
import { computePhaseBudgets } from "../meetup/schedule";
import { MEETUP_FLOW, phaseLabel } from "../meetup/stateMachine";

/**
 * 只提醒、不自動推進：流程要不要往下走永遠由主辦人手動輸入「下一步」/「跳過」決定，
 * 這裡只是在某階段快超出建立小聚時分配到的預計時間時推播提醒，幫主辦人抓時間。
 *
 * phaseStartedAt 在每次進入新階段（含跳過、繼續）時重設，所以算的是「這階段」而非
 * 整場活動的剩餘時間；phaseReminderSent 確保同一階段只提醒一次。
 */
export async function sweepPhaseReminders(): Promise<void> {
  const env = loadEnv();
  if (!env.MEETUP_PHASE_REMINDER_ENABLED) return;

  const candidates = await prisma.meetup.findMany({
    where: {
      phase: { in: MEETUP_FLOW },
      phaseReminderSent: false,
      phaseStartedAt: { not: null },
      plannedMinutes: { not: null },
    },
    include: { group: true },
    take: 50,
  });

  for (const meetup of candidates) {
    if (!meetup.phaseStartedAt || !meetup.plannedMinutes) continue;

    const budget = computePhaseBudgets(meetup.plannedMinutes)[meetup.phase];
    if (budget <= 0) continue;

    const elapsedMinutes = (Date.now() - meetup.phaseStartedAt.getTime()) / 60000;
    const remainingMinutes = budget - elapsedMinutes;
    if (remainingMinutes > env.MEETUP_PHASE_REMINDER_LEAD_MINUTES) continue;

    await prisma.meetup.update({ where: { id: meetup.id }, data: { phaseReminderSent: true } });
    logger.info({ meetupId: meetup.id, phase: meetup.phase }, "meetup phase reminder sent");

    if (meetup.group.isActive) {
      const remainingLabel = Math.max(0, Math.round(remainingMinutes));
      await pushTextWithLimit(
        meetup.group.lineGroupId,
        `⏰「${phaseLabel(meetup.phase)}」階段預計時間快到了（大約還剩 ${remainingLabel} 分鐘），主辦人可以準備輸入「下一步」繼續囉！`,
        buildMeetupQuickReply({ type: "host_controls", phase: meetup.phase }),
      ).catch((err) => logger.warn({ err }, "meetup phase reminder push failed"));
    }
  }
}
