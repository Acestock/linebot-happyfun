import { describe, expect, it } from "vitest";
import { buildAllTimeTopThreeCard, buildLeaderboardCard, isWordleLeaderboardCommand } from "../messages";
import type { AllTimeEntry, Leaderboard } from "../manager";

describe("isWordleLeaderboardCommand", () => {
  it("matches 'wordle' and 'wordle 排行', case-insensitively and trimmed", () => {
    expect(isWordleLeaderboardCommand("wordle")).toBe(true);
    expect(isWordleLeaderboardCommand("Wordle")).toBe(true);
    expect(isWordleLeaderboardCommand("  wordle 排行  ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(isWordleLeaderboardCommand("wordle是什麼")).toBe(false);
    expect(isWordleLeaderboardCommand("hello")).toBe(false);
  });
});

function flexBodyText(message: ReturnType<typeof buildLeaderboardCard>): string {
  return JSON.stringify(message);
}

describe("buildLeaderboardCard", () => {
  it("prompts to play when nobody has played today, but still offers the top-3 button", () => {
    const empty: Leaderboard = { date: "2026-07-22", entries: [] };
    const card = buildLeaderboardCard(empty);
    const json = flexBodyText(card);
    expect(json).toContain("每日 Wordle");
    expect(json).toContain("action=wordle_top3");
  });

  it("ranks entries by best score with medals in order", () => {
    const board: Leaderboard = {
      date: "2026-07-22",
      entries: [
        { memberId: "a", displayName: "小明", bestScore: 180, bestCombo: 4, roundsSolved: 5, roundsPlayed: 5 },
        { memberId: "b", displayName: "小華", bestScore: 150, bestCombo: 3, roundsSolved: 3, roundsPlayed: 4 },
        { memberId: "c", displayName: "阿凱", bestScore: 120, bestCombo: 2, roundsSolved: 2, roundsPlayed: 3 },
        { memberId: "d", displayName: "第四名", bestScore: 100, bestCombo: 1, roundsSolved: 1, roundsPlayed: 2 },
      ],
    };
    const json = flexBodyText(buildLeaderboardCard(board));
    expect(json).toContain("🥇");
    expect(json).toContain("小明");
    expect(json).toContain("180 分");
    expect(json).toContain("🥈");
    expect(json).toContain("小華");
    expect(json).toContain("🥉");
    expect(json).toContain("阿凱");
    expect(json).toContain("4.");
    expect(json).toContain("第四名");
  });
});

describe("buildAllTimeTopThreeCard", () => {
  it("prompts to play when there is no record yet", () => {
    const json = flexBodyText(buildAllTimeTopThreeCard([]));
    expect(json).toContain("還沒有任何紀錄");
  });

  it("shows up to three all-time entries with the date each score was set", () => {
    const entries: AllTimeEntry[] = [
      { memberId: "a", displayName: "小明", bestScore: 250, bestCombo: 6, date: "2026-07-10" },
      { memberId: "b", displayName: "小華", bestScore: 200, bestCombo: 5, date: "2026-07-15" },
    ];
    const json = flexBodyText(buildAllTimeTopThreeCard(entries));
    expect(json).toContain("小明");
    expect(json).toContain("250 分");
    expect(json).toContain("2026-07-10");
    expect(json).toContain("小華");
    expect(json).toContain("2026-07-15");
  });
});
