import type { CopyIntent } from "../../persona/types";
import type { GameDefinition, GameState, InitialState, MoveResult } from "../engine/types";
import {
  applyRoundGuess,
  buildScoreboard,
  createRoundsState,
  currentRound,
  skipRound,
  type Round,
  type RoundsState,
} from "./rounds";
import { generateRounds } from "./questionGen";
import { getRecentQuestions, recordQuestions } from "./questionHistory";

function asState(state: GameState): RoundsState {
  return state as unknown as RoundsState;
}

const SKIP_KEYWORDS = new Set(["跳過", "skip", "pass"]);

export interface RoundsGameOptions {
  gameType: string;
  displayName: string;
  emoji: string;
  shortDescription: string;
  roundCount: number;
  generationPrompt: string;
  fallbackBank: Round[];
  /** 隨機挑幾個塞進出題 prompt，逼 AI 別每次都想到同一批經典題 */
  categoryPool?: string[];
  /** 每題開場/公布下一題時要怎麼呈現題目文字（例如加不加「題目：」前綴） */
  formatQuestion: (question: string, roundNumber: number, total: number) => string;
  openingIntro: string;
  resultIntent?: CopyIntent;
}

export function pickCategoryHint(pool: string[] | undefined): string | undefined {
  if (!pool || pool.length === 0) return undefined;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length)).join("、");
}

/** 優先挑最近沒出過的題目；扣掉重複後題庫不夠再放寬允許重複，遊戲永遠開得起來 */
export function pickRounds(bank: Round[], count: number, avoid: Set<string>): Round[] {
  const fresh = bank.filter((r) => !avoid.has(r.question));
  const pool = fresh.length >= count ? fresh : bank;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 生產「開局先備妥全部題目、之後零 LLM 呼叫作答」的搶答型遊戲。
 * 機智問答、Emoji 猜謎共用這一套，之後要加新的搶答遊戲只要換 prompt/題庫。
 */
export function createRoundsGame(options: RoundsGameOptions): GameDefinition {
  return {
    gameType: options.gameType,
    displayName: options.displayName,
    emoji: options.emoji,
    shortDescription: options.shortDescription,

    async createInitialState(groupId: string): Promise<InitialState> {
      const recentlyAsked = await getRecentQuestions(groupId, options.gameType);
      const generated = await generateRounds(options.generationPrompt, options.roundCount, {
        categoryHint: pickCategoryHint(options.categoryPool),
        avoidQuestions: recentlyAsked,
      });
      const rounds =
        generated ?? pickRounds(options.fallbackBank, options.roundCount, new Set(recentlyAsked));
      const state = createRoundsState(rounds);

      void recordQuestions(
        groupId,
        options.gameType,
        rounds.map((r) => r.question),
      );

      return {
        state,
        config: { roundCount: rounds.length, usedAi: generated !== null },
        openingText:
          `${options.emoji} ${options.displayName}開局！${options.openingIntro}\n` +
          `共 ${rounds.length} 題，搶答制，直接打答案就好，想跳過輸入「跳過」\n\n` +
          options.formatQuestion(currentRound(state).question, 1, rounds.length),
      };
    },

    parseMove(text) {
      const trimmed = text.trim();
      if (trimmed.length === 0) return null;
      if (SKIP_KEYWORDS.has(trimmed.toLowerCase())) return { type: "skip" };
      return { type: "guess", text: trimmed };
    },

    applyMove(rawState, move, ctx): MoveResult {
      const state = asState(rawState);
      const total = state.rounds.length;

      if (move.type === "skip") {
        const { state: nextState, outcome } = skipRound(state);
        if (outcome.type !== "skipped") throw new Error("unreachable");

        if (outcome.finished) {
          const { text: scoreboard, winnerId } = buildScoreboard(nextState);
          return {
            nextState,
            finished: true,
            winnerMemberId: winnerId ?? undefined,
            recordMove: true,
            movePayload: { skip: true },
            moveOutcome: { roundIndex: state.idx },
            replyText: `最後一題公布答案：${outcome.answer}\n\n🏆 最終戰績\n${scoreboard}`,
            aiIntent: options.resultIntent ?? "result",
            aiContext: { 遊戲: options.displayName, 戰績板: scoreboard },
          };
        }

        return {
          nextState,
          finished: false,
          recordMove: true,
          movePayload: { skip: true },
          moveOutcome: { roundIndex: state.idx },
          replyText: `這題答案是：${outcome.answer}\n\n${options.formatQuestion(outcome.nextQuestion ?? "", state.idx + 2, total)}`,
        };
      }

      const guess = move.text as string;
      const { state: nextState, outcome } = applyRoundGuess(
        state,
        ctx.memberId,
        ctx.memberName,
        guess,
      );

      if (outcome.type === "wrong") {
        return {
          nextState,
          finished: false,
          recordMove: true,
          movePayload: { guess },
          moveOutcome: { correct: false },
          replyText: null, // 答錯不洗版，保持沉默
        };
      }

      if (outcome.finished) {
        const { text: scoreboard, winnerId } = buildScoreboard(nextState);
        return {
          nextState,
          finished: true,
          winnerMemberId: winnerId ?? undefined,
          recordMove: true,
          movePayload: { guess },
          moveOutcome: { correct: true, roundIndex: state.idx },
          replyText:
            `✅ ${ctx.memberName ?? "有人"} 答對了！答案：${outcome.answer}\n\n` +
            `🏆 最終戰績\n${scoreboard}`,
          aiIntent: options.resultIntent ?? "result",
          aiContext: { 遊戲: options.displayName, 戰績板: scoreboard },
        };
      }

      return {
        nextState,
        finished: false,
        recordMove: true,
        movePayload: { guess },
        moveOutcome: { correct: true, roundIndex: state.idx },
        replyText:
          `✅ ${ctx.memberName ?? "有人"} 答對了！答案：${outcome.answer}\n\n` +
          options.formatQuestion(outcome.nextQuestion ?? "", state.idx + 2, total),
      };
    },

    cancelText(rawState) {
      const state = asState(rawState);
      const round = currentRound(state);
      return `${options.displayName}中途結束～目前這題答案是：${round?.answers[0] ?? "（無）"}，輸入 party 隨時再玩！`;
    },

    inProgressText(rawState) {
      const state = asState(rawState);
      return `${options.displayName}進行中（第 ${state.idx + 1}/${state.rounds.length} 題）！直接打答案搶答，或輸入「跳過」跳到下一題。`;
    },
  };
}
