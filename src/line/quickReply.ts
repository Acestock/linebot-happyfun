import type { messagingApi } from "@line/bot-sdk";

/**
 * LINE 的 Rich Menu（聊天室底部常駐懸浮選單）官方明確不支援群組/多人聊天室，
 * 只會出現在一對一聊天。群組裡最接近「一鍵觸發、不用打字」的做法是 Quick Reply
 * ——附加在機器人每一則訊息上，跟著訊息一起浮出兩顆按鈕。
 */
export function buildPartyQuickReply(): messagingApi.QuickReply {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "🎉 party", text: "party" },
      },
      {
        type: "action",
        action: {
          type: "postback",
          label: "🛑 結束遊戲",
          data: "action=cancel_game",
          displayText: "結束目前的遊戲",
        },
      },
    ],
  };
}

/** 幫訊息陣列的最後一則附上 Quick Reply（LINE 只認訊息陣列裡最後一則的 quickReply） */
export function withPartyQuickReply(
  messages: messagingApi.Message[],
): messagingApi.Message[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  return [...messages.slice(0, -1), { ...last, quickReply: buildPartyQuickReply() }];
}
