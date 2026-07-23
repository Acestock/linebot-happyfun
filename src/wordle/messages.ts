import type { messagingApi } from "@line/bot-sdk";
import type { AllTimeEntry, Leaderboard, LeaderboardEntry } from "./manager";

/** 拉取式排行榜卡片 — 純函式，manager.ts 負責撈資料，這裡只排版。 */

export const WORDLE_LEADERBOARD_KEYWORDS = ["wordle", "wordle 排行"];

export function isWordleLeaderboardCommand(text: string): boolean {
  return WORDLE_LEADERBOARD_KEYWORDS.includes(text.trim().toLowerCase());
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PRIMARY = "#538D4E";
const PRIMARY_BG = "#EAF7EA";

type FlexBox = Record<string, unknown>;

function headerBox(title: string, subtitle: string): FlexBox {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: PRIMARY,
    paddingAll: "16px",
    contents: [
      { type: "text", text: title, weight: "bold", size: "md", color: "#FFFFFF" },
      { type: "text", text: subtitle, size: "xs", color: "#EAF7EA", margin: "sm" },
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
          {
            type: "text",
            text: `連擊 x${entry.bestCombo}．解出 ${entry.roundsSolved}/${entry.roundsPlayed} 題`,
            size: "xxs",
            color: "#888888",
          },
        ],
      },
      { type: "text", text: `${entry.bestScore} 分`, size: "sm", weight: "bold", color: PRIMARY, flex: 0, gravity: "center" },
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
          { type: "text", text: `${entry.date} 締造．連擊 x${entry.bestCombo}`, size: "xxs", color: "#888888" },
        ],
      },
      { type: "text", text: `${entry.bestScore} 分`, size: "sm", weight: "bold", color: PRIMARY, flex: 0, gravity: "center" },
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
            text: "今天還沒有人玩過 Wordle，打開選單裡的「🔤 每日 Wordle」來挑戰吧！",
            size: "sm",
            color: "#888888",
            wrap: true,
          },
        ]
      : leaderboard.entries.map((entry, i) => leaderboardRow(MEDALS[i] ?? `${i + 1}.`, entry));

  const bubble: FlexBox = {
    type: "bubble",
    size: "mega",
    header: headerBox("🔤 今日 Wordle 排行榜", `${leaderboard.date}．依單回合最高分排名`),
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "16px", contents: body },
    footer: footerButton({
      type: "postback",
      label: "🏆 歷史最高分 TOP 3",
      data: "action=wordle_top3",
      displayText: "查看 Wordle 歷史最高分 TOP 3",
    }),
  };

  return {
    type: "flex",
    altText: `🔤 今日 Wordle 排行榜（${leaderboard.date}）`,
    contents: bubble as unknown as messagingApi.FlexBubble,
  };
}

export function buildAllTimeTopThreeCard(entries: AllTimeEntry[]): messagingApi.Message {
  const body: FlexBox[] =
    entries.length === 0
      ? [{ type: "text", text: "還沒有任何紀錄，快去挑戰創下第一筆紀錄吧！", size: "sm", color: "#888888", wrap: true }]
      : entries.map((entry, i) => allTimeRow(MEDALS[i] ?? `${i + 1}.`, entry));

  const bubble: FlexBox = {
    type: "bubble",
    size: "mega",
    header: headerBox("🏆 Wordle 史上最高分 TOP 3", "不限日期．單回合最高分"),
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "16px", contents: body },
    footer: footerButton({ type: "message", label: "📊 今日排行榜", text: "wordle 排行" }),
  };

  return {
    type: "flex",
    altText: "🏆 Wordle 史上最高分 TOP 3",
    contents: bubble as unknown as messagingApi.FlexBubble,
  };
}
