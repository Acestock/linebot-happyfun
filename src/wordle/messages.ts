import type { Leaderboard } from "./manager";

/** 拉取式排行榜文字 — 純函式，manager.ts 負責撈資料，這裡只排版。 */

export const WORDLE_LEADERBOARD_KEYWORDS = ["wordle", "wordle 排行"];

export function isWordleLeaderboardCommand(text: string): boolean {
  return WORDLE_LEADERBOARD_KEYWORDS.includes(text.trim().toLowerCase());
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function buildLeaderboardText(leaderboard: Leaderboard): string {
  if (leaderboard.entries.length === 0) {
    return "今天還沒有人玩過 Wordle，打開選單裡的「🔤 每日 Wordle」來挑戰吧！";
  }

  const lines = [`🔤 今日 Wordle 排行榜（${leaderboard.date}）— 依單回合最高分排名\n`];

  leaderboard.entries.forEach((entry, i) => {
    const medal = MEDALS[i] ?? `${i + 1}.`;
    lines.push(
      `${medal} ${entry.displayName}　${entry.bestScore} 分（連擊 x${entry.bestCombo}，解出 ${entry.roundsSolved}/${entry.roundsPlayed} 題）`,
    );
  });

  return lines.join("\n");
}
