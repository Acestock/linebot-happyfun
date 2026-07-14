import type { GameDefinition, GameState, MoveResult } from "../engine/types";
import {
  DEFAULT_CONFIG,
  type GuessNumberState,
  applyGuess,
  createState,
  parseGuess,
} from "./stateMachine";

function asState(state: GameState): GuessNumberState {
  return state as unknown as GuessNumberState;
}

export const guessNumberGame: GameDefinition = {
  gameType: "guess_number",
  displayName: "終極密碼",
  emoji: "🔢",
  shortDescription: `猜一個 ${DEFAULT_CONFIG.min}~${DEFAULT_CONFIG.max} 的神祕數字，我會提示太大或太小，猜中的人獲勝！`,

  createInitialState() {
    const state = createState(DEFAULT_CONFIG);
    return {
      state,
      config: { min: state.min, max: state.max },
      openingText:
        `🎮 終極密碼開局！\n` +
        `我已經想好一個 ${state.min}~${state.max} 之間的數字，` +
        `直接在群組輸入數字就可以猜，猜中的人獲勝🏆`,
      aiContext: {
        遊戲: "終極密碼（猜數字）",
        範圍: `${state.min}~${state.max}`,
        玩法: "在群組直接輸入數字猜，主持人提示太大或太小，猜中的人獲勝",
      },
    };
  },

  parseMove(text) {
    const guess = parseGuess(text);
    return guess === null ? null : { guess };
  },

  applyMove(rawState, move, ctx): MoveResult {
    const state = asState(rawState);
    const guess = move.guess as number;
    const { state: nextState, outcome } = applyGuess(state, ctx.memberId, guess);

    switch (outcome.type) {
      case "out_of_range":
        return {
          nextState,
          finished: false,
          recordMove: false,
          replyText: `${guess} 超出範圍囉，要猜 ${outcome.lowerBound}~${outcome.upperBound} 之間！`,
        };
      case "too_low":
        return {
          nextState,
          finished: false,
          recordMove: true,
          movePayload: { guess },
          moveOutcome: { direction: "too_low" },
          replyText: `${guess} 太小了👇 目前範圍：${outcome.lowerBound}~${outcome.upperBound}`,
        };
      case "too_high":
        return {
          nextState,
          finished: false,
          recordMove: true,
          movePayload: { guess },
          moveOutcome: { direction: "too_high" },
          replyText: `${guess} 太大了☝️ 目前範圍：${outcome.lowerBound}~${outcome.upperBound}`,
        };
      case "win":
        return {
          nextState,
          finished: true,
          winnerMemberId: ctx.memberId,
          recordMove: true,
          movePayload: { guess },
          moveOutcome: { win: true },
          replyText:
            `🎉 賓果！答案就是 ${guess}！\n` +
            `本局共猜了 ${outcome.attempts} 次，恭喜獲勝🏆\n` +
            `輸入 party 隨時再開一局～`,
          aiContext: {
            遊戲: "終極密碼（猜數字）",
            答案: guess,
            全場總猜測次數: outcome.attempts,
          },
        };
    }
  },

  cancelText(rawState) {
    const state = asState(rawState);
    return `本局終極密碼結束～答案其實是 ${state.answer}！輸入 party 隨時再來一局。`;
  },

  inProgressText(rawState) {
    const state = asState(rawState);
    return `終極密碼還在進行中喔！目前範圍：${state.lowerBound}~${state.upperBound}，直接輸入數字就能猜。想重開可以先點選單裡的「結束目前遊戲」。`;
  },
};
