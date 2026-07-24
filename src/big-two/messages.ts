import type { messagingApi } from "@line/bot-sdk";
import type { AllTimeEntry, Leaderboard, LeaderboardEntry } from "./manager";

/** 拉取式排行榜卡片 — 純函式，manager.ts 負責撈資料，這裡只排版。 */

export const BIG_TWO_LEADERBOARD_KEYWORDS = ["大老二", "大老二 排行"];

export function isBigTwoLeaderboardCommand(text: string): boolean {
  return BIG_TWO_LEADERBOARD_KEYWORDS.includes(text.trim());
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PRIMARY = "#2C2C2C";
const PRIMARY_BG = "#EDEDED";

type FlexBox = Record<string, unknown>;

function headerBox(title: string, subtitle: string): FlexBox {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: PRIMARY,
    paddingAll: "16px",
    contents: [
      { type: "text", text: title, weight: "bold", size: "md", color: "#FFFFFF" },
      { type: "text", text: subtitle, size: "xs", color: "#DDDDDD", margin: "sm" },
    ],
  };
}

function leaderboardRow(rank: string, entry: LeaderboardEntry): FlexBox {
  return {
    type: "box",
    layout: "horizontal",
    alignItems: "center",
    spacing: "sm",
    contents: [
      { type: "text", text: rank, size: "sm", flex: 0, gravity: "center" },
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: entry.displayName, size: "sm", weight: "bold", color: "#333333", wrap: true },
          { type: "text", text: `勝場 ${entry.wins}．場次 ${entry.gamesPlayed}`, size: "xxs", color: "#888888" },
        ],
      },
      { type: "text", text: `${entry.points} 分`, size: "sm", weight: "bold", color: PRIMARY, flex: 0, gravity: "center" },
    ],
  };
}

function allTimeRow(rank: string, entry: AllTimeEntry): FlexBox {
  return {
    type: "box",
    layout: "horizontal",
    alignItems: "center",
    spacing: "sm",
    contents: [
      { type: "text", text: rank, size: "sm", flex: 0, gravity: "center" },
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          { type: "text", text: entry.displayName, size: "sm", weight: "bold", color: "#333333", wrap: true },
          { type: "text", text: `${entry.date} 締造．勝場 ${entry.wins}`, size: "xxs", color: "#888888" },
        ],
      },
      { type: "text", text: `${entry.points} 分`, size: "sm", weight: "bold", color: PRIMARY, flex: 0, gravity: "center" },
    ],
  };
}

function footerButton(action: FlexBox): FlexBox {
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "12px",
    contents: [{ type: "button", style: "secondary", height: "sm", color: PRIMARY_BG, action }],
  };
}

export function buildLeaderboardCard(leaderboard: Leaderboard): messagingApi.Message {
  const body: FlexBox[] =
    leaderboard.entries.length === 0
      ? [
          {
            type: "text",
            text: "今天還沒有人玩過大老二，打開選單裡的「🃏 大老二對戰」揪團吧！",
            size: "sm",
            color: "#888888",
            wrap: true,
          },
        ]
      : leaderboard.entries.map((entry, i) => leaderboardRow(MEDALS[i] ?? `${i + 1}.`, entry));

  const bubble: FlexBox = {
    type: "bubble",
    size: "mega",
    header: headerBox("🃏 今日大老二排行榜", `${leaderboard.date}．依累積積分排名`),
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "16px", contents: body },
    footer: footerButton({
      type: "postback",
      label: "🏆 歷史最高分 TOP 3",
      data: "action=big_two_top3",
      displayText: "查看大老二歷史最高分 TOP 3",
    }),
  };

  return {
    type: "flex",
    altText: `🃏 今日大老二排行榜（${leaderboard.date}）`,
    contents: bubble as unknown as messagingApi.FlexBubble,
  };
}

export function buildAllTimeTopThreeCard(entries: AllTimeEntry[]): messagingApi.Message {
  const body: FlexBox[] =
    entries.length === 0
      ? [{ type: "text", text: "還沒有任何紀錄，快去揪一場大老二創下第一筆紀錄吧！", size: "sm", color: "#888888", wrap: true }]
      : entries.map((entry, i) => allTimeRow(MEDALS[i] ?? `${i + 1}.`, entry));

  const bubble: FlexBox = {
    type: "bubble",
    size: "mega",
    header: headerBox("🏆 大老二史上最高分 TOP 3", "不限日期．單日累積積分"),
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "16px", contents: body },
    footer: footerButton({ type: "message", label: "📊 今日排行榜", text: "大老二 排行" }),
  };

  return {
    type: "flex",
    altText: "🏆 大老二史上最高分 TOP 3",
    contents: bubble as unknown as messagingApi.FlexBubble,
  };
}

/** 開局時推播到群組的邀請卡片，通知大家點開 LIFF 加入或旁觀。 */
export function buildGameInviteCard(hostName: string, seatCount: number, liffUrl: string): messagingApi.Message {
  const bubble: FlexBox = {
    type: "bubble",
    size: "mega",
    header: headerBox("🃏 大老二開局囉！", `${hostName} 揪了一桌 ${seatCount} 人局`),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "還缺人手，點下面的按鈕加入戰局！座位滿了的話也可以進去旁觀這場對局。",
          size: "sm",
          color: "#333333",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [{ type: "button", style: "primary", height: "sm", color: PRIMARY, action: { type: "uri", label: "🃏 點我加入／旁觀", uri: liffUrl } }],
    },
  };

  return {
    type: "flex",
    altText: `🃏 ${hostName} 揪了一桌大老二，點我加入！`,
    contents: bubble as unknown as messagingApi.FlexBubble,
  };
}
