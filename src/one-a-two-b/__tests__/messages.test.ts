import { describe, expect, it } from "vitest";
import { buildLeaderboardText, isOneATwoBLeaderboardCommand } from "../messages";
import type { Leaderboard } from "../manager";

describe("isOneATwoBLeaderboardCommand", () => {
  it("matches '1a2b' and '1a2b 排行', case-insensitively and trimmed", () => {
    expect(isOneATwoBLeaderboardCommand("1a2b")).toBe(true);
    expect(isOneATwoBLeaderboardCommand("1A2B")).toBe(true);
    expect(isOneATwoBLeaderboardCommand("  1a2b 排行  ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(isOneATwoBLeaderboardCommand("1a2b是什麼")).toBe(false);
    expect(isOneATwoBLeaderboardCommand("hello")).toBe(false);
  });
});

describe("buildLeaderboardText", () => {
  it("prompts to play when nobody has played today", () => {
    const empty: Leaderboard = { date: "2026-07-22", entries: [] };
    expect(buildLeaderboardText(empty)).toContain("每日 1A2B");
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
    const text = buildLeaderboardText(board);
    expect(text).toContain("🥇 小明");
    expect(text).toContain("180 分");
    expect(text).toContain("🥈 小華");
    expect(text).toContain("🥉 阿凱");
    expect(text).toContain("4. 第四名");
  });
});
