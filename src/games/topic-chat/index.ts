import type { GameDefinition, GameState, MoveResult } from "../engine/types";
import {
  type TopicChatState,
  createTopicState,
  isSummonSummary,
  recordMessage,
} from "./logic";

const FALLBACK_TOPICS = [
  "如果明天開始可以不用上班/上課一個月，你第一件事要做什麼？",
  "人生中吃過最雷的一餐是什麼？在哪裡踩的雷？",
  "手機裡最捨不得刪的一張照片是什麼？",
  "如果只能推薦一部影集/電影給這個群的人，你選哪部？",
  "你各位覺得：早餐店奶茶到底為什麼特別好喝？",
];

function asState(state: GameState): TopicChatState {
  return state as unknown as TopicChatState;
}

export const topicChatGame: GameDefinition = {
  gameType: "topic_chat",
  displayName: "話題時間",
  emoji: "💬",
  shortDescription: "我丟一個話題讓大家聊，偶爾插嘴帶風向，想收尾就喊「總結」！",

  createInitialState() {
    const state = createTopicState();
    const fallbackTopic = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
    return {
      state,
      config: {},
      openingText:
        `💬 話題時間開始！\n${fallbackTopic}\n` +
        `大家自由聊，我偶爾會插嘴～想收尾的時候輸入「總結」！`,
      aiIntent: "topic_opening",
      aiContext: {
        情境: "在 LINE 群組開啟話題時間",
        備用話題: fallbackTopic,
      },
    };
  },

  parseMove(text) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return null;
    if (isSummonSummary(trimmed)) return { type: "summary" };
    return { type: "chat", text: trimmed };
  },

  applyMove(rawState, move, ctx): MoveResult {
    const state = asState(rawState);

    if (move.type === "summary") {
      return {
        nextState: state,
        finished: true,
        recordMove: true,
        movePayload: { type: "summary_requested" },
        moveOutcome: { messages: Object.values(state.guessesByMember).reduce((a, b) => a + b, 0) },
        replyText:
          "今天的話題時間到此結束🎤 感謝各位的發言，每一句我都記在小本本上了，輸入 party 隨時再開！",
        aiIntent: "topic_summary",
        aiContext: {
          最近對話: state.recentMessages.join("\n") || "（大家還沒聊什麼）",
          發言總數: Object.values(state.guessesByMember).reduce((a, b) => a + b, 0),
        },
      };
    }

    const { state: nextState, shouldChime } = recordMessage(
      state,
      ctx.memberId,
      ctx.memberName,
      move.text as string,
    );

    if (!shouldChime) {
      // 保持沉默，只累積上下文
      return { nextState, finished: false, recordMove: false, replyText: null };
    }

    return {
      nextState,
      finished: false,
      recordMove: false,
      replyText: "哦？這個話題越來越精彩了，繼續繼續👀",
      aiIntent: "topic_chime",
      aiContext: {
        最近對話: nextState.recentMessages.join("\n"),
      },
    };
  },

  cancelText() {
    return "話題時間收工🎤 大家聊得很讚，輸入 party 隨時再開一場！";
  },

  inProgressText() {
    return "話題時間進行中喔💬 大家繼續聊，想收尾就輸入「總結」，我來做個漂亮的 ending！";
  },
};
