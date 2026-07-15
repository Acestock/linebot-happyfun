import { describe, expect, it } from "vitest";
import { buildLeaderboardText, isWordleLeaderboardCommand } from "../messages";
import type { Leaderboard } from "../manager";

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

describe("buildLeaderboardText", () => {
  it("prompts to play when no puzzle has been touched yet today", () => {
    const empty: Leaderboard = { puzzleDate: null, solved: [], unsolvedCount: 0 };
    expect(buildLeaderboardText(empty)).toContain("每日 Wordle");
  });

  it("prompts to play when the puzzle exists but nobody has solved it", () => {
    const noSolvers: Leaderboard = { puzzleDate: "2026-07-16", solved: [], unsolvedCount: 2 };
    const text = buildLeaderboardText(noSolvers);
    expect(text).toContain("還沒有人過關");
    expect(text).toContain("還有 2 人正在挑戰中");
  });

  it("ranks solved entries with medals in order", () => {
    const board: Leaderboard = {
      puzzleDate: "2026-07-16",
      solved: [
        { memberId: "a", displayName: "小明", guessCount: 3, durationMs: 1000 },
        { memberId: "b", displayName: "小華", guessCount: 4, durationMs: 2000 },
        { memberId: "c", displayName: "阿凱", guessCount: 5, durationMs: 3000 },
        { memberId: "d", displayName: "第四名", guessCount: 6, durationMs: 4000 },
      ],
      unsolvedCount: 0,
    };
    const text = buildLeaderboardText(board);
    expect(text).toContain("🥇 小明");
    expect(text).toContain("🥈 小華");
    expect(text).toContain("🥉 阿凱");
    expect(text).toContain("4. 第四名");
    expect(text).not.toContain("正在挑戰中");
  });
});
