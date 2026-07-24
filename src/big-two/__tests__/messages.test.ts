import { describe, expect, it } from "vitest";
import { buildAllTimeTopThreeCard, buildGameInviteCard, buildLeaderboardCard, isBigTwoLeaderboardCommand } from "../messages";
import type { AllTimeEntry, Leaderboard } from "../manager";

describe("isBigTwoLeaderboardCommand", () => {
  it("matches '大老二' and '大老二 排行'", () => {
    expect(isBigTwoLeaderboardCommand("大老二")).toBe(true);
    expect(isBigTwoLeaderboardCommand("大老二 排行")).toBe(true);
    expect(isBigTwoLeaderboardCommand("  大老二  ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(isBigTwoLeaderboardCommand("大老二是什麼")).toBe(false);
    expect(isBigTwoLeaderboardCommand("hello")).toBe(false);
  });
});

function flexBodyText(message: ReturnType<typeof buildLeaderboardCard>): string {
  return JSON.stringify(message);
}

describe("buildLeaderboardCard", () => {
  it("prompts to play when nobody has played today, but still offers the top-3 button", () => {
    const empty: Leaderboard = { date: "2026-07-24", entries: [] };
    const json = flexBodyText(buildLeaderboardCard(empty));
    expect(json).toContain("大老二");
    expect(json).toContain("action=big_two_top3");
  });

  it("ranks entries by points with medals in order", () => {
    const board: Leaderboard = {
      date: "2026-07-24",
      entries: [
        { memberId: "a", displayName: "小明", points: 9, wins: 3, gamesPlayed: 3, bestRank: 1 },
        { memberId: "b", displayName: "小華", points: 5, wins: 1, gamesPlayed: 3, bestRank: 1 },
        { memberId: "c", displayName: "阿凱", points: 2, wins: 0, gamesPlayed: 2, bestRank: 2 },
      ],
    };
    const json = flexBodyText(buildLeaderboardCard(board));
    expect(json).toContain("🥇");
    expect(json).toContain("小明");
    expect(json).toContain("9 分");
    expect(json).toContain("🥈");
    expect(json).toContain("小華");
    expect(json).toContain("🥉");
    expect(json).toContain("阿凱");
  });
});

describe("buildAllTimeTopThreeCard", () => {
  it("prompts to play when there is no record yet", () => {
    const json = flexBodyText(buildAllTimeTopThreeCard([]));
    expect(json).toContain("還沒有任何紀錄");
  });

  it("shows up to three all-time entries with the date each score was set", () => {
    const entries: AllTimeEntry[] = [
      { memberId: "a", displayName: "小明", points: 9, wins: 3, date: "2026-07-10" },
      { memberId: "b", displayName: "小華", points: 6, wins: 2, date: "2026-07-15" },
    ];
    const json = flexBodyText(buildAllTimeTopThreeCard(entries));
    expect(json).toContain("小明");
    expect(json).toContain("9 分");
    expect(json).toContain("2026-07-10");
    expect(json).toContain("小華");
    expect(json).toContain("2026-07-15");
  });
});

describe("buildGameInviteCard", () => {
  it("includes the host's name, seat count, and a uri action pointing at the LIFF url", () => {
    const message = buildGameInviteCard("小明", 4, "https://liff.line.me/1234-abcd?groupId=Cabc");
    const json = JSON.stringify(message);
    expect(json).toContain("小明");
    expect(json).toContain("4 人局");
    expect(json).toContain("https://liff.line.me/1234-abcd?groupId=Cabc");
    expect(json).toContain('"type":"uri"');
  });
});
