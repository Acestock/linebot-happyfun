import type { Leaderboard } from "./manager";

/** 拉取式排行榜文字 — 純函式，manager.ts 負責撈資料，這裡只排版。 */

export const ONE_A_TWO_B_LEADERBOARD_KEYWORDS = ["1a2b", "1a2b 排行"];

export function isOneATwoBLeaderboardCommand(text: string): boolean {
  return ONE_A_TWO_B_LEADERBOARD_KEYWORDS.includes(text.trim().toLowerCase());
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function buildLeaderboardText(leaderboard: Leaderboard): string {
  if (leaderboard.entries.length === 0) {
    return "今天還沒有人玩過 1A2B，打開選單裡的「🔐 每日 1A2B」來挑戰吧！";
  }

  const lines = [`🔐 今日 1A2B 排行榜（${leaderboard.date}）— 依單回合最高分排名\n`];

  leaderboard.entries.forEach((entry, i) => {
    const medal = MEDALS[i] ?? `${i + 1}.`;
    lines.push(
      `${medal} ${entry.displayName}　${entry.bestScore} 分（連擊 x${entry.bestCombo}，解出 ${entry.roundsSolved}/${entry.roundsPlayed} 題）`,
    );
  });

  return lines.join("\n");
}
