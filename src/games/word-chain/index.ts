import type { GameDefinition, GameState, MoveResult } from "../engine/types";
import { buildLeaderboard } from "../shared/rounds";
import {
  type WordChainState,
  applyWord,
  createWordChainState,
  isSummonSummary,
  isWordCandidate,
} from "./logic";

const START_WORDS = ["快樂", "遊戲", "朋友", "陽光", "冒險", "音樂", "旅行", "星星"];

function asState(state: GameState): WordChainState {
  return state as unknown as WordChainState;
}

export const wordChainGame: GameDefinition = {
  gameType: "word_chain",
  displayName: "文字接龍",
  emoji: "🔗",
  shortDescription: "從一個詞開始接龍，後一詞字首要接前一詞字尾，喊「總結」結束！",

  createInitialState() {
    const startWord = START_WORDS[Math.floor(Math.random() * START_WORDS.length)];
    const state = createWordChainState(startWord);
    return {
      state,
      config: { startWord },
      openingText:
        `🔗 文字接龍開始！第一個詞：「${startWord}」\n` +
        `接下一個詞的開頭要是「${startWord.slice(-1)}」，兩個字以上的詞都可以，我會偶爾插嘴，喊「總結」隨時可以收尾！`,
    };
  },

  parseMove(text) {
    const trimmed = text.trim();
    if (isSummonSummary(trimmed)) return { type: "summary" };
    if (isWordCandidate(trimmed)) return { type: "word", word: trimmed };
    return null;
  },

  applyMove(rawState, move, ctx): MoveResult {
    const state = asState(rawState);

    if (move.type === "summary") {
      const { text: leaderboard, winnerId } = buildLeaderboard(
        state.guessesByMember,
        state.namesById,
        "詞",
      );
      return {
        nextState: state,
        finished: true,
        winnerMemberId: winnerId ?? undefined,
        recordMove: true,
        movePayload: { type: "summary_requested" },
        moveOutcome: { chainLength: state.chain.length },
        replyText: `接龍結束🔗 這條龍接了 ${state.chain.length} 個詞！\n\n🏆 貢獻榜\n${leaderboard}`,
        aiIntent: "wordchain_summary",
        aiContext: {
          最近接龍紀錄: state.recentEntries.join(" → "),
          總接龍數: state.chain.length,
        },
      };
    }

    const word = move.word as string;
    const { state: nextState, outcome } = applyWord(state, ctx.memberId, ctx.memberName, word);

    if (outcome.type === "rejected") {
      const reasonText =
        outcome.reason === "duplicate" ? "這個詞已經接過囉" : `要接「${outcome.expectedStart}」開頭的詞喔`;
      return {
        nextState,
        finished: false,
        recordMove: false,
        replyText: `❌ ${reasonText}`,
      };
    }

    if (!outcome.shouldChime) {
      return { nextState, finished: false, recordMove: true, movePayload: { word }, moveOutcome: { accepted: true }, replyText: null };
    }

    return {
      nextState,
      finished: false,
      recordMove: true,
      movePayload: { word },
      moveOutcome: { accepted: true },
      replyText: "接得不錯嘛👀 繼續接～",
      aiIntent: "wordchain_chime",
      aiContext: { 最近接龍紀錄: nextState.recentEntries.join(" → ") },
    };
  },

  cancelText(rawState) {
    const state = asState(rawState);
    return `文字接龍結束～這條龍接了 ${state.chain.length} 個詞，輸入 party 隨時再玩！`;
  },

  inProgressText(rawState) {
    const state = asState(rawState);
    const last = state.chain[state.chain.length - 1];
    return `文字接龍進行中！目前接到「${last}」，下一個詞開頭要是「${last.slice(-1)}」。喊「總結」可以結束。`;
  },
};
