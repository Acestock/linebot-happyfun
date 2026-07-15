import type { WordleAttempt, WordlePuzzle } from "@prisma/client";
import { prisma } from "../db/prisma";
import { computeFeedback, isValidGuess, isWin, MAX_GUESSES, pickDailyWord, type LetterFeedback } from "./logic";

/**
 * 小遊戲的 DB orchestration 層，跟 src/meetup/manager.ts 同樣的角色 —
 * 純邏輯在 logic.ts，這裡只負責撈資料、組資料、寫資料。不直接單元測試，
 * 用真的本機 Postgres 跑 smoke script 驗證（跟 meetup 功能同一套驗證方式）。
 */

export interface MemberIdentity {
  id: string;
  displayName: string | null;
}

const RECENT_PUZZLES_TO_AVOID = 30;

/** 台灣（UTC+8）當天日期字串，例如 "2026-07-16"；固定位移就夠，不需要日期函式庫 */
export function taipeiDateString(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** 每天一題、全部群組共用；懶惰建立（不用排程），第一個打進來的請求順便把當天題目生出來 */
export async function getOrCreateTodaysPuzzle(): Promise<WordlePuzzle> {
  const date = taipeiDateString();
  const existing = await prisma.wordlePuzzle.findUnique({ where: { date } });
  if (existing) return existing;

  const recent = await prisma.wordlePuzzle.findMany({
    orderBy: { date: "desc" },
    take: RECENT_PUZZLES_TO_AVOID,
    select: { answer: true },
  });
  const answer = pickDailyWord(date, recent.map((r) => r.answer));

  // upsert 而非單純 create：同一秒兩個請求同時撞見「今天還沒有題目」時，靠資料庫
  // 層級的 ON CONFLICT 保證只會真的建立一筆，不會炸出 unique constraint 錯誤
  return prisma.wordlePuzzle.upsert({ where: { date }, create: { date, answer }, update: {} });
}

export interface GuessRow {
  guess: string;
  feedback: LetterFeedback[];
}

export interface AttemptState {
  puzzleDate: string;
  rows: GuessRow[];
  solved: boolean;
  guessesRemaining: number;
}

function toAttemptState(puzzle: WordlePuzzle, attempt: WordleAttempt): AttemptState {
  const guesses = Array.isArray(attempt.guesses) ? (attempt.guesses as string[]) : [];
  return {
    puzzleDate: puzzle.date,
    rows: guesses.map((guess) => ({ guess, feedback: computeFeedback(puzzle.answer, guess) })),
    solved: attempt.solved,
    guessesRemaining: Math.max(0, MAX_GUESSES - guesses.length),
  };
}

async function getOrCreateAttemptRow(puzzleId: string, groupId: string, memberId: string): Promise<WordleAttempt> {
  return prisma.wordleAttempt.upsert({
    where: { puzzleId_memberId: { puzzleId, memberId } },
    create: { puzzleId, groupId, memberId },
    update: {},
  });
}

/** LIFF 頁面載入時呼叫，取得（或建立）這個人今天的挑戰狀態，讓關掉重開可以接續 */
export async function getOrCreateAttempt(groupId: string, member: MemberIdentity): Promise<AttemptState> {
  const puzzle = await getOrCreateTodaysPuzzle();
  const attempt = await getOrCreateAttemptRow(puzzle.id, groupId, member.id);
  return toAttemptState(puzzle, attempt);
}

export type SubmitGuessResult =
  | { ok: true; state: AttemptState }
  | { ok: false; error: "invalid_word" | "already_finished" };

export async function submitGuess(
  groupId: string,
  member: MemberIdentity,
  rawGuess: string,
): Promise<SubmitGuessResult> {
  const guess = rawGuess.trim().toUpperCase();
  const puzzle = await getOrCreateTodaysPuzzle();
  const attempt = await getOrCreateAttemptRow(puzzle.id, groupId, member.id);

  const guesses = Array.isArray(attempt.guesses) ? (attempt.guesses as string[]) : [];
  if (attempt.solved || guesses.length >= MAX_GUESSES) {
    return { ok: false, error: "already_finished" };
  }
  if (!isValidGuess(guess)) {
    return { ok: false, error: "invalid_word" };
  }

  const nextGuesses = [...guesses, guess];
  const feedback = computeFeedback(puzzle.answer, guess);
  const won = isWin(feedback);
  const exhausted = !won && nextGuesses.length >= MAX_GUESSES;
  const isFinished = won || exhausted;

  const updated = await prisma.wordleAttempt.update({
    where: { id: attempt.id },
    data: {
      guesses: nextGuesses,
      ...(isFinished
        ? { solved: won, finishedAt: new Date(), durationMs: Date.now() - attempt.createdAt.getTime() }
        : {}),
    },
  });

  return { ok: true, state: toAttemptState(puzzle, updated) };
}

export interface LeaderboardEntry {
  memberId: string;
  displayName: string;
  guessCount: number;
  durationMs: number | null;
}

export interface Leaderboard {
  /** null 代表這個群組今天完全沒人碰過 Wordle（連題目都還沒被生出來） */
  puzzleDate: string | null;
  solved: LeaderboardEntry[];
  unsolvedCount: number;
}

/** 群組內今天的排行榜：過關的依猜測次數、再依花費時間排序；未過關的（含還在玩的）只算人數，不排名 */
export async function getLeaderboard(groupId: string): Promise<Leaderboard> {
  const puzzle = await getOrCreateTodaysPuzzle();
  const attempts = await prisma.wordleAttempt.findMany({
    where: { puzzleId: puzzle.id, groupId },
    include: { member: true },
  });

  const solved = attempts
    .filter((a) => a.solved)
    .map((a) => ({
      memberId: a.memberId,
      displayName: a.member.displayName ?? "神秘玩家",
      guessCount: Array.isArray(a.guesses) ? (a.guesses as string[]).length : 0,
      durationMs: a.durationMs,
    }))
    .sort((a, b) => {
      if (a.guessCount !== b.guessCount) return a.guessCount - b.guessCount;
      return (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity);
    });

  const unsolvedCount = attempts.filter((a) => !a.solved).length;

  return { puzzleDate: puzzle.date, solved, unsolvedCount };
}
