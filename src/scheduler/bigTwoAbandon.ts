import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { sweepAbandonedGames } from "../big-two/manager";

/** 定時掃描棄局：LOBBY 太久沒開局、PLAYING 太久沒人動作的大老二牌局自動取消。 */
export async function sweepAbandonedBigTwoGames(): Promise<void> {
  const env = loadEnv();
  const count = await sweepAbandonedGames(env.BIG_TWO_LOBBY_ABANDON_MINUTES, env.BIG_TWO_PLAYING_ABANDON_MINUTES);
  if (count > 0) {
    logger.info({ count }, "cancelled abandoned big-two games");
  }
}
