import type { messagingApi } from "@line/bot-sdk";
import { loadEnv } from "../config/env";
import { listGames } from "../games/engine/registry";
import type { GameDefinition } from "../games/engine/types";

export const PARTY_KEYWORD = "party";

export function isPartyCommand(text: string): boolean {
  return text.trim().toLowerCase() === PARTY_KEYWORD;
}

const ROW_COLORS = ["#FFF0F6", "#F0F4FF", "#FFF8E1", "#F0FFF4", "#F5F0FF"];

const PREMIUM_GOLD = "#B8860B";
const PREMIUM_BG = "#FFF9EC";

const LIFF_TEAL = "#0EA5A5";
const LIFF_BG = "#E9FBFA";

/**
 * 選單列表寸土寸金，備註說明一律鎖死一行：wrap+maxLines 是 LINE Flex 自己按實際
 * 渲染寬度算截斷點、超出就補「…」，比自己土法猜字數準，也不會被迫換行撐高整列。
 * 完整說明還是看 buildHelpText()（「📖 說明」按鈕），不受這裡影響。
 */
function menuDescriptionText(text: string, color: string) {
  return {
    type: "text" as const,
    text,
    size: "xxs" as const,
    color,
    wrap: true,
    maxLines: 1,
  };
}

/**
 * 開啟 LIFF 頁面的項目卡（目前有每日 Wordle、每日 1A2B）。除了打開遊戲的主要區塊
 * （uri action）以外，底下再附一條細長的「查看排行榜」次要按鈕（message action，
 * 效果等同直接在群組打「wordle 排行」）——兩個各自獨立的可點擊區域包在同一張卡片裡。
 */
function liffGameCard(emoji: string, title: string, description: string, uri: string, leaderboardCommand: string) {
  return {
    type: "box" as const,
    layout: "vertical" as const,
    backgroundColor: LIFF_BG,
    borderColor: LIFF_TEAL,
    borderWidth: "1px",
    cornerRadius: "lg" as const,
    paddingAll: "6px",
    spacing: "xs" as const,
    contents: [
      {
        type: "box" as const,
        layout: "horizontal" as const,
        spacing: "xs" as const,
        alignItems: "center" as const,
        action: {
          type: "uri" as const,
          uri,
        },
        contents: [
          {
            type: "text" as const,
            text: emoji,
            size: "md" as const,
            flex: 0,
            gravity: "center" as const,
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            flex: 1,
            contents: [
              { type: "text" as const, text: title, weight: "bold" as const, size: "xs" as const, color: "#333333" },
              menuDescriptionText(description, "#888888"),
            ],
          },
          {
            type: "text" as const,
            text: "▶",
            size: "xxs" as const,
            color: LIFF_TEAL,
            flex: 0,
            gravity: "center" as const,
          },
        ],
      },
      {
        type: "box" as const,
        layout: "horizontal" as const,
        justifyContent: "center" as const,
        paddingAll: "0px",
        action: {
          type: "message" as const,
          text: leaderboardCommand,
        },
        contents: [
          {
            type: "text" as const,
            text: "📊 查看排行榜",
            size: "xxs" as const,
            color: LIFF_TEAL,
            weight: "bold" as const,
          },
        ],
      },
    ],
  };
}

/** 付費區的項目（目前只有小聚活動主持人）。點擊送出對應的純文字指令，跟使用者自己打字效果一致。 */
function premiumRow(emoji: string, title: string, description: string, triggerText: string) {
  return {
    type: "box" as const,
    layout: "horizontal" as const,
    backgroundColor: PREMIUM_BG,
    borderColor: PREMIUM_GOLD,
    borderWidth: "1px",
    cornerRadius: "lg" as const,
    paddingAll: "6px",
    spacing: "xs" as const,
    alignItems: "center" as const,
    action: {
      type: "message" as const,
      text: triggerText,
    },
    contents: [
      {
        type: "text" as const,
        text: emoji,
        size: "md" as const,
        flex: 0,
        gravity: "center" as const,
      },
      {
        type: "box" as const,
        layout: "vertical" as const,
        flex: 1,
        contents: [
          {
            type: "box" as const,
            layout: "horizontal" as const,
            spacing: "xs" as const,
            contents: [
              { type: "text" as const, text: title, weight: "bold" as const, size: "xs" as const, color: "#333333" },
              {
                type: "text" as const,
                text: "💎 付費",
                size: "xxs" as const,
                color: PREMIUM_GOLD,
                weight: "bold" as const,
              },
            ],
          },
          menuDescriptionText(description, "#888888"),
        ],
      },
      {
        type: "text" as const,
        text: "▶",
        size: "xxs" as const,
        color: PREMIUM_GOLD,
        flex: 0,
        gravity: "center" as const,
      },
    ],
  };
}

function gameRow(game: GameDefinition, index: number) {
  return {
    type: "box" as const,
    layout: "horizontal" as const,
    backgroundColor: ROW_COLORS[index % ROW_COLORS.length],
    cornerRadius: "lg" as const,
    paddingAll: "6px",
    spacing: "xs" as const,
    alignItems: "center" as const,
    action: {
      type: "postback" as const,
      data: `action=start_game&game=${game.gameType}`,
      displayText: `開始${game.displayName}！`,
    },
    contents: [
      {
        type: "text" as const,
        text: game.emoji,
        size: "md" as const,
        flex: 0,
        gravity: "center" as const,
      },
      {
        type: "box" as const,
        layout: "vertical" as const,
        flex: 1,
        contents: [
          {
            type: "text" as const,
            text: game.displayName,
            weight: "bold" as const,
            size: "xs" as const,
            color: "#333333",
          },
          menuDescriptionText(game.shortDescription, "#888888"),
        ],
      },
      {
        type: "text" as const,
        text: "▶",
        size: "xxs" as const,
        color: "#9C6ADE",
        flex: 0,
        gravity: "center" as const,
      },
    ],
  };
}

export function buildPartyMenu(): messagingApi.Message {
  const games = listGames();
  const env = loadEnv();
  // 每個 LIFF 小遊戲各自檢查有沒有設定對應的 LIFF_ID（例如本機開發還沒申請），
  // 沒設定就不顯示那顆按鈕，免得點下去打開一個沒用的連結。
  const liffGameRows = [
    env.LIFF_ID
      ? liffGameCard(
          "🔤",
          "每日 Wordle",
          "5 字母猜猜看，跟群組一起拚排行榜",
          `https://liff.line.me/${env.LIFF_ID}`,
          "wordle 排行",
        )
      : null,
    env.LIFF_ID_ONE_A_TWO_B
      ? liffGameCard(
          "🔐",
          "每日 1A2B",
          "猜 4 位不重複數字密碼，幾A幾B推理出答案",
          `https://liff.line.me/${env.LIFF_ID_ONE_A_TWO_B}`,
          "1a2b 排行",
        )
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  const liffRows =
    liffGameRows.length > 0
      ? [
          { type: "separator" as const, margin: "md" as const },
          {
            type: "text" as const,
            text: "🧩 網頁小遊戲",
            size: "xxs" as const,
            color: LIFF_TEAL,
            weight: "bold" as const,
            margin: "md" as const,
          },
          ...liffGameRows,
        ]
      : [];

  return {
    type: "flex",
    altText: "🎉 Party Time！輸入 party 開啟遊戲選單",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#9C6ADE",
        paddingAll: "16px",
        paddingBottom: "18px",
        contents: [
          {
            type: "text",
            text: "🎉🎈  P A R T Y   T I M E  🎈🎉",
            weight: "bold",
            size: "md",
            color: "#FFFFFF",
            align: "center",
          },
          {
            type: "text",
            text: "點一下直接開玩，我來當主持人～",
            size: "xxs",
            color: "#F3E8FF",
            margin: "sm",
            align: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        paddingAll: "12px",
        contents: [
          ...games.map((game, i) => gameRow(game, i)),
          ...liffRows,
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "💎 進階功能",
            size: "xxs",
            color: PREMIUM_GOLD,
            weight: "bold",
            margin: "md",
          },
          premiumRow(
            "🎪",
            "小聚活動主持人",
            "簽到、破冰、互動一手包辦，適合 5~30 人的聚會",
            "建立小聚",
          ),
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            color: "#F0F0F0",
            action: {
              type: "postback",
              label: "📖 說明",
              data: "action=help",
              displayText: "怎麼玩？",
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            color: "#F0F0F0",
            action: {
              type: "postback",
              label: "🛑 結束遊戲",
              data: "action=cancel_game",
              displayText: "結束目前的遊戲",
            },
          },
        ],
      },
    },
  };
}

export function buildHelpText(): string {
  const games = listGames();
  const gameLines = games
    .map((g) => `${g.emoji} ${g.displayName}：${g.shortDescription}`)
    .join("\n");
  const env = loadEnv();
  const liffLines = [
    env.LIFF_ID
      ? `🔤 每日 Wordle：5 次機會猜出今天的 5 字母單字，輸入「wordle 排行」查看群組排行榜。`
      : null,
    env.LIFF_ID_ONE_A_TWO_B
      ? `🔐 每日 1A2B：猜一組 4 位不重複的數字密碼，10 次機會內用幾A幾B推理出答案，輸入「1a2b 排行」查看群組排行榜。`
      : null,
  ].filter((line): line is string => line !== null);
  const liffSection = liffLines.length > 0 ? `\n🧩 網頁小遊戲（選單上點開）：\n${liffLines.join("\n")}` : "";

  return (
    `📖 使用說明\n` +
    `━━━━━━━━━━\n` +
    `1️⃣ 在群組輸入「party」開啟遊戲選單\n` +
    `2️⃣ 點一下想玩的遊戲卡片就開局\n` +
    `3️⃣ 遊戲進行中直接在群組輸入內容互動（例如終極密碼就直接打數字、接龍直接打詞）\n` +
    `4️⃣ 想中止遊戲，點選單裡的「🛑 結束遊戲」\n` +
    `━━━━━━━━━━\n` +
    `目前的遊戲：\n${gameLines}\n` +
    `\n💎 進階功能：輸入「建立小聚」開始一場有主持人的活動，詳見選單上的付費區。` +
    liffSection +
    `\n之後還會有更多玩法陸續加入，敬請期待🎊`
  );
}
