/**
 * 話題模式純邏輯 — 決定 AI 什麼時候插嘴（不是每句都回）。
 */

export interface TopicChatState extends Record<string, unknown> {
  messagesSinceLastReply: number;
  /** 下一次插嘴需要累積到的訊息數（隨機 5~8，避免太規律） */
  nextChimeAfter: number;
  chimesUsed: number;
  /** 最近對話（給 LLM 當上下文），最多 MAX_RECENT 則 */
  recentMessages: string[];
  /** 每位成員的發言數（結算時寫入 participants；沿用 guessesByMember 欄位名以共用結算邏輯） */
  guessesByMember: Record<string, number>;
}

export const MAX_CHIMES_PER_SESSION = 8;
export const MAX_RECENT = 8;

const CHIME_MIN_GAP = 5;
const CHIME_MAX_GAP = 8;

export function randomChimeGap(rand: () => number = Math.random): number {
  return CHIME_MIN_GAP + Math.floor(rand() * (CHIME_MAX_GAP - CHIME_MIN_GAP + 1));
}

export function createTopicState(rand: () => number = Math.random): TopicChatState {
  return {
    messagesSinceLastReply: 0,
    nextChimeAfter: randomChimeGap(rand),
    chimesUsed: 0,
    recentMessages: [],
    guessesByMember: {},
  };
}

export function isSummonSummary(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "總結" || trimmed === "阿密總結" || trimmed === "阿密 總結";
}

export interface RecordedMessage {
  state: TopicChatState;
  shouldChime: boolean;
}

export function recordMessage(
  state: TopicChatState,
  memberId: string,
  memberName: string | null,
  text: string,
  rand: () => number = Math.random,
): RecordedMessage {
  const recentMessages = [
    ...state.recentMessages,
    `${memberName ?? "某位成員"}：${text.slice(0, 100)}`,
  ].slice(-MAX_RECENT);

  const guessesByMember = {
    ...state.guessesByMember,
    [memberId]: (state.guessesByMember[memberId] ?? 0) + 1,
  };

  const messagesSinceLastReply = state.messagesSinceLastReply + 1;
  const canChime = state.chimesUsed < MAX_CHIMES_PER_SESSION;
  const shouldChime = canChime && messagesSinceLastReply >= state.nextChimeAfter;

  if (shouldChime) {
    return {
      shouldChime: true,
      state: {
        ...state,
        recentMessages,
        guessesByMember,
        messagesSinceLastReply: 0,
        nextChimeAfter: randomChimeGap(rand),
        chimesUsed: state.chimesUsed + 1,
      },
    };
  }

  return {
    shouldChime: false,
    state: { ...state, recentMessages, guessesByMember, messagesSinceLastReply },
  };
}
