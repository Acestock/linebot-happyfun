/**
 * 文字接龍純邏輯 — 兩字以上中文詞，後一個詞的字首要接前一個詞的字尾。
 * AI 偶爾插嘴（沿用話題模式的節流策略），不評判每一個詞。
 */

export interface WordChainState extends Record<string, unknown> {
  chain: string[];
  usedWords: string[];
  guessesByMember: Record<string, number>;
  namesById: Record<string, string>;
  messagesSinceLastReply: number;
  nextChimeAfter: number;
  chimesUsed: number;
  recentEntries: string[];
}

export const MAX_CHIMES_PER_SESSION = 6;
export const MAX_RECENT = 8;
const CHIME_MIN_GAP = 4;
const CHIME_MAX_GAP = 7;
const WORD_PATTERN = /^[一-鿿]{2,8}$/;

function randomChimeGap(rand: () => number): number {
  return CHIME_MIN_GAP + Math.floor(rand() * (CHIME_MAX_GAP - CHIME_MIN_GAP + 1));
}

export function createWordChainState(
  startWord: string,
  rand: () => number = Math.random,
): WordChainState {
  return {
    chain: [startWord],
    usedWords: [startWord],
    guessesByMember: {},
    namesById: {},
    messagesSinceLastReply: 0,
    nextChimeAfter: randomChimeGap(rand),
    chimesUsed: 0,
    recentEntries: [`（起手）${startWord}`],
  };
}

export function isWordCandidate(text: string): boolean {
  return WORD_PATTERN.test(text.trim());
}

export function isSummonSummary(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "總結" || trimmed === "接龍總結" || trimmed === "阿密總結";
}

export type WordOutcome =
  | { type: "accepted"; word: string; shouldChime: boolean }
  | { type: "rejected"; reason: "wrong_start" | "duplicate"; expectedStart: string };

export function applyWord(
  state: WordChainState,
  memberId: string,
  memberName: string | null,
  word: string,
  rand: () => number = Math.random,
): { state: WordChainState; outcome: WordOutcome } {
  const lastWord = state.chain[state.chain.length - 1];
  const expectedStart = lastWord.slice(-1);

  if (state.usedWords.includes(word)) {
    return { state, outcome: { type: "rejected", reason: "duplicate", expectedStart } };
  }
  if (word[0] !== expectedStart) {
    return { state, outcome: { type: "rejected", reason: "wrong_start", expectedStart } };
  }

  const namesById = memberName ? { ...state.namesById, [memberId]: memberName } : state.namesById;
  const guessesByMember = {
    ...state.guessesByMember,
    [memberId]: (state.guessesByMember[memberId] ?? 0) + 1,
  };
  const recentEntries = [
    ...state.recentEntries,
    `${memberName ?? "某位成員"}：${word}`,
  ].slice(-MAX_RECENT);

  const messagesSinceLastReply = state.messagesSinceLastReply + 1;
  const canChime = state.chimesUsed < MAX_CHIMES_PER_SESSION;
  const shouldChime = canChime && messagesSinceLastReply >= state.nextChimeAfter;

  const base: WordChainState = {
    ...state,
    chain: [...state.chain, word],
    usedWords: [...state.usedWords, word],
    namesById,
    guessesByMember,
    recentEntries,
  };

  if (shouldChime) {
    return {
      state: {
        ...base,
        messagesSinceLastReply: 0,
        nextChimeAfter: randomChimeGap(rand),
        chimesUsed: state.chimesUsed + 1,
      },
      outcome: { type: "accepted", word, shouldChime: true },
    };
  }

  return {
    state: { ...base, messagesSinceLastReply },
    outcome: { type: "accepted", word, shouldChime: false },
  };
}
