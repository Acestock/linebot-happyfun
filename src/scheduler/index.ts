import cron from "node-cron";
import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { sweepTimedOutGames } from "./gameTimeout";
import { sweepIdleGroups } from "./idleNudge";
import { sweepIdleMeetups } from "./meetupTimeout";
import { sweepPhaseReminders } from "./meetupPhaseReminder";

function everyNMinutes(n: number): string {
  const clamped = Math.min(Math.max(Math.round(n), 1), 59);
  return `*/${clamped} * * * *`;
}

/** 啟動固定間隔掃描（事件觸發 + 固定間隔，非高頻輪詢，控制 Railway 用量） */
export function startSchedulers(): void {
  const env = loadEnv();

  cron.schedule(everyNMinutes(env.GAME_TIMEOUT_SWEEP_INTERVAL_MINUTES), () => {
    sweepTimedOutGames().catch((err) => logger.error({ err }, "game timeout sweep failed"));
  });

  // 閒置主動互動預設關閉（IDLE_NUDGE_ENABLED=true 才開），互動一律由 party 觸發
  if (env.IDLE_NUDGE_ENABLED) {
    cron.schedule(everyNMinutes(env.IDLE_NUDGE_SWEEP_INTERVAL_MINUTES), () => {
      sweepIdleGroups().catch((err) => logger.error({ err }, "idle nudge sweep failed"));
    });
  }

  // 小聚閒置逾時預設開啟：主辦人忘記結束會卡住整個群組的 party/遊戲功能，這是可靠度保險絲
  if (env.MEETUP_IDLE_TIMEOUT_ENABLED) {
    cron.schedule(everyNMinutes(env.MEETUP_IDLE_SWEEP_INTERVAL_MINUTES), () => {
      sweepIdleMeetups().catch((err) => logger.error({ err }, "meetup idle sweep failed"));
    });
  }

  // 小聚各階段時間快到時提醒主辦人，預設開啟；只提醒不自動推進，流程仍由主辦人手動控制
  if (env.MEETUP_PHASE_REMINDER_ENABLED) {
    cron.schedule(everyNMinutes(env.MEETUP_PHASE_REMINDER_SWEEP_INTERVAL_MINUTES), () => {
      sweepPhaseReminders().catch((err) => logger.error({ err }, "meetup phase reminder sweep failed"));
    });
  }

  logger.info(
    {
      gameTimeoutEveryMin: env.GAME_TIMEOUT_SWEEP_INTERVAL_MINUTES,
      idleNudgeEnabled: env.IDLE_NUDGE_ENABLED,
      meetupIdleTimeoutEnabled: env.MEETUP_IDLE_TIMEOUT_ENABLED,
      meetupPhaseReminderEnabled: env.MEETUP_PHASE_REMINDER_ENABLED,
    },
    "schedulers started",
  );
}
