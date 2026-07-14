import type { messagingApi } from "@line/bot-sdk";
import { listGames } from "../games/engine/registry";
import type { GameDefinition } from "../games/engine/types";

export const PARTY_KEYWORD = "party";

export function isPartyCommand(text: string): boolean {
  return text.trim().toLowerCase() === PARTY_KEYWORD;
}

const ROW_COLORS = ["#FFF0F6", "#F0F4FF", "#FFF8E1", "#F0FFF4", "#F5F0FF"];

function gameRow(game: GameDefinition, index: number) {
  return {
    type: "box" as const,
    layout: "horizontal" as const,
    backgroundColor: ROW_COLORS[index % ROW_COLORS.length],
    cornerRadius: "lg" as const,
    paddingAll: "10px",
    spacing: "sm" as const,
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
        size: "xl" as const,
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
            size: "sm" as const,
            color: "#333333",
          },
          {
            type: "text" as const,
            text: game.shortDescription,
            size: "xxs" as const,
            color: "#888888",
            wrap: true,
          },
        ],
      },
      {
        type: "text" as const,
        text: "▶",
        size: "xs" as const,
        color: "#9C6ADE",
        flex: 0,
        gravity: "center" as const,
      },
    ],
  };
}

export function buildPartyMenu(): messagingApi.Message {
  const games = listGames();

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
        spacing: "sm",
        paddingAll: "12px",
        contents: games.map((game, i) => gameRow(game, i)),
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

  return (
    `📖 使用說明\n` +
    `━━━━━━━━━━\n` +
    `1️⃣ 在群組輸入「party」開啟遊戲選單\n` +
    `2️⃣ 點一下想玩的遊戲卡片就開局\n` +
    `3️⃣ 遊戲進行中直接在群組輸入內容互動（例如終極密碼就直接打數字、接龍直接打詞）\n` +
    `4️⃣ 想中止遊戲，點選單裡的「🛑 結束遊戲」\n` +
    `━━━━━━━━━━\n` +
    `目前的遊戲：\n${gameLines}\n` +
    `\n之後還會有更多玩法陸續加入，敬請期待🎊`
  );
}
