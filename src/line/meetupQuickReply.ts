import { MeetupPhase } from "@prisma/client";
import type { messagingApi } from "@line/bot-sdk";
import type { MeetupUiHint } from "../meetup/manager";

/** 依 messagingApi.QuickReplyItem 的 postback 短碼組一顆按鈕（對應 src/meetup/commands.ts 的短碼） */
function postbackItem(label: string, code: string, displayText: string): messagingApi.QuickReplyItem {
  return {
    type: "action",
    action: { type: "postback", label, data: `action=meetup&cmd=${code}`, displayText },
  };
}

function messageItem(label: string, text: string): messagingApi.QuickReplyItem {
  return { type: "action", action: { type: "message", label, text } };
}

const NEXT = () => postbackItem("➡️ 下一步", "next", "下一步");
const SKIP = () => postbackItem("⏭️ 跳過", "skip", "跳過");
const CHANGE = () => postbackItem("🔄 換題目", "change", "換題目");
const PAUSE = () => postbackItem("⏸️ 暫停", "pause", "暫停小聚");
const RESUME = () => postbackItem("▶️ 繼續", "resume", "繼續小聚");
const END = () => postbackItem("🏁 結束活動", "end", "結束小聚");
const START = () => postbackItem("▶️ 開始活動", "start", "開始小聚");

function hostControlItems(phase: MeetupPhase): messagingApi.QuickReplyItem[] {
  if (phase === MeetupPhase.PAUSED) return [RESUME(), END()];

  const items = [NEXT(), SKIP()];
  if (phase === MeetupPhase.ICEBREAKER || phase === MeetupPhase.INTERACTION) {
    items.push(CHANGE());
  }
  items.push(PAUSE(), END());
  return items;
}

export function buildMeetupQuickReply(ui: MeetupUiHint): messagingApi.QuickReply | undefined {
  switch (ui.type) {
    case "none":
      return undefined;
    case "setup_options":
      return { items: ui.options.map((opt) => messageItem(opt, opt)) };
    case "ready":
      return { items: [START()] };
    case "host_controls":
      return { items: hostControlItems(ui.phase) };
    case "checkin":
      return { items: [messageItem("🙋 我到了", "我到了"), NEXT(), SKIP(), PAUSE(), END()] };
    case "closing":
      return {
        items: [
          messageItem("很喜歡", "很喜歡"),
          messageItem("還不錯", "還不錯"),
          messageItem("可以更好", "可以更好"),
          END(),
        ],
      };
  }
}
