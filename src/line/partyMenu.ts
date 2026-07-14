import type { messagingApi } from "@line/bot-sdk";
import { listGames } from "../games/engine/registry";

export const PARTY_KEYWORD = "party";

export function isPartyCommand(text: string): boolean {
  return text.trim().toLowerCase() === PARTY_KEYWORD;
}

export function buildPartyMenu(): messagingApi.Message {
  const games = listGames();

  const gameButtons = games.map((game) => ({
    type: "button" as const,
    style: "primary" as const,
    height: "sm" as const,
    action: {
      type: "postback" as const,
      label: `${game.emoji} ${game.displayName}`,
      data: `action=start_game&game=${game.gameType}`,
      displayText: `開始${game.displayName}！`,
    },
  }));

  const gameList = games
    .map((game) => `${game.emoji} ${game.displayName}｜${game.shortDescription}`)
    .join("\n");

  return {
    type: "flex",
    altText: "🎉 Party Time！輸入 party 開啟遊戲選單",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#7C4DFF",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "🎉 Party Time！",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "我是這群的氣氛組，來玩點什麼吧！",
            size: "sm",
            color: "#EDE7F6",
            margin: "sm",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "目前可以玩的遊戲",
            weight: "bold",
            size: "md",
          },
          {
            type: "text",
            text: gameList,
            size: "sm",
            color: "#666666",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          ...gameButtons,
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "📖 使用說明",
              data: "action=help",
              displayText: "怎麼玩？",
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "🛑 結束目前遊戲",
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
    `2️⃣ 點選遊戲按鈕開局\n` +
    `3️⃣ 遊戲進行中直接在群組輸入內容互動（例如終極密碼就直接打數字）\n` +
    `4️⃣ 想中止遊戲，點選單裡的「🛑 結束目前遊戲」\n` +
    `━━━━━━━━━━\n` +
    `目前的遊戲：\n${gameLines}\n` +
    `\n之後還會有更多玩法陸續加入，敬請期待🎊`
  );
}
