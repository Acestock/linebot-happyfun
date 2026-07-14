import cron from "node-cron";
import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { sweepTimedOutGames } from "./gameTimeout";
import { sweepIdleGroups } from "./idleNudge";

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

  cron.schedule(everyNMinutes(env.IDLE_NUDGE_SWEEP_INTERVAL_MINUTES), () => {
    sweepIdleGroups().catch((err) => logger.error({ err }, "idle nudge sweep failed"));
  });

  logger.info(
    {
      gameTimeoutEveryMin: env.GAME_TIMEOUT_SWEEP_INTERVAL_MINUTES,
      idleNudgeEveryMin: env.IDLE_NUDGE_SWEEP_INTERVAL_MINUTES,
    },
    "schedulers started",
  );
}
