import type { WordleDailyStats, WordleRound } from "@prisma/client";
import { prisma } from "../db/prisma";
import {
  baseScoreForGuesses,
  computeFeedback,
  isValidGuess,
  isWin,
  MAX_GUESSES,
  pickRoundWord,
  type LetterFeedback,
} from "./logic";
import { comboMultiplier, roundScore, speedBonus, timeLimitForStreak } from "../shared/gameScoring";

/**
 * 小遊戲的 DB orchestration 層，跟 src/meetup/manager.ts 同樣的角色 —
 * 純邏輯在 logic.ts（跟共用的 src/shared/gameScoring.ts），這裡只負責撈資料、組資料、
 * 寫資料。不直接單元測試，用真的本機 Postgres 跑 smoke script 驗證。
 *
 * v2（連續挑戰＋計分）：題目不再是「全群組共用同一天同一題」，而是每個人自己的一連串
 * 回合（WordleRound）——解完一題可以馬上開下一題，連續答對（combo）疊加分數倍率，
 * 但每題的作答時限會隨連續題數縮短，超時直接判本回合失敗、combo 歸零。
 * WordleDailyStats 是每人每天的彙總，排行榜直接讀這張表的 bestScore。
 */

export interface MemberIdentity {
  id: string;
  displayName: string | null;
}

const RECENT_ANSWERS_TO_AVOID = 30;

/** 台灣（UTC+8）當天日期字串，例如 "2026-07-16"；固定位移就夠，不需要日期函式庫 */
export function taipeiDateString(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export interface GuessRow {
  guess: string;
  feedback: LetterFeedback[];
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  multiplier: number;
}

export interface RoundView {
  roundIndex: number;
  streakPosition: number;
  timeLimitSeconds: number;
  /** ISO 字串；回合已結束時為 null。前端倒數只是視覺，真正判定一律以後端為準 */
  guessDeadlineAt: string | null;
  rows: GuessRow[];
  guessesRemaining: number;
  solved: boolean;
  timedOut: boolean;
  finished: boolean;
  score: number;
  /** 只有「剛解開的那次回應」才有值——結算卡用來顯示「基礎 N + 手速加成 N，x 連擊倍率」；
   * 之後重新整理頁面不會重算（沒存到 DB，純粹是那次慶祝畫面的即時資訊）。 */
  scoreBreakdown: ScoreBreakdown | null;
}

export interface DailyStatsView {
  date: string;
  roundsPlayed: number;
  roundsSolved: number;
  bestScore: number;
  currentCombo: number;
  bestCombo: number;
}

export interface SessionState {
  /** null 代表今天還沒開始第一題，前端要顯示「開始挑戰」按鈕呼叫 startNextRound */
  round: RoundView | null;
  dailyStats: DailyStatsView;
}

function toDailyStatsView(stats: WordleDailyStats): DailyStatsView {
  return {
    date: stats.date,
    roundsPlayed: stats.roundsPlayed,
    roundsSolved: stats.roundsSolved,
    bestScore: stats.bestScore,
    currentCombo: stats.currentCombo,
    bestCombo: stats.bestCombo,
  };
}

function toRoundView(round: WordleRound, scoreBreakdown: ScoreBreakdown | null = null): RoundView {
  const guesses = Array.isArray(round.guesses) ? (round.guesses as string[]) : [];
  return {
    roundIndex: round.roundIndex,
    streakPosition: round.streakPosition,
    timeLimitSeconds: round.timeLimitSeconds,
    guessDeadlineAt: round.guessDeadlineAt ? round.guessDeadlineAt.toISOString() : null,
    rows: guesses.map((guess) => ({ guess, feedback: computeFeedback(round.answer, guess) })),
    guessesRemaining: Math.max(0, MAX_GUESSES - guesses.length),
    solved: round.solved,
    timedOut: round.timedOut,
    finished: round.finishedAt !== null,
    score: round.score,
    scoreBreakdown,
  };
}

async function getOrCreateDailyStats(groupId: string, memberId: string, date: string): Promise<WordleDailyStats> {
  return prisma.wordleDailyStats.upsert({
    where: { groupId_memberId_date: { groupId, memberId, date } },
    create: { groupId, memberId, date },
    update: {},
  });
}

/** 找今天最後一筆回合；如果它其實已經超時（過了 deadline 卻沒送出），懶惰結算掉再回傳。 */
async function getLatestRoundSettled(groupId: string, memberId: string, date: string): Promise<WordleRound | null> {
  const latest = await prisma.wordleRound.findFirst({
    where: { groupId, memberId, date },
    orderBy: { roundIndex: "desc" },
  });
  if (!latest) return null;
  if (latest.finishedAt !== null) return latest;
  if (!latest.guessDeadlineAt || latest.guessDeadlineAt.getTime() > Date.now()) return latest;

  // 過了 deadline 還沒送出下一次猜測 → 判超時，本回合失敗、combo 歸零
  const [updatedRound] = await prisma.$transaction([
    prisma.wordleRound.update({
      where: { id: latest.id },
      data: {
        timedOut: true,
        finishedAt: new Date(),
        durationMs: Date.now() - latest.startedAt.getTime(),
        score: 0,
        guessDeadlineAt: null,
      },
    }),
    prisma.wordleDailyStats.update({
      where: { groupId_memberId_date: { groupId, memberId, date } },
      data: { currentCombo: 0 },
    }),
  ]);
  return updatedRound;
}

/** LIFF 頁面載入時呼叫：today 的彙總 + 目前（或剛結束）的回合狀態，不會自動開新題。 */
export async function getSessionState(groupId: string, member: MemberIdentity): Promise<SessionState> {
  const date = taipeiDateString();
  const dailyStats = await getOrCreateDailyStats(groupId, member.id, date);
  const round = await getLatestRoundSettled(groupId, member.id, date);
  return {
    round: round ? toRoundView(round) : null,
    dailyStats: toDailyStatsView(dailyStats),
  };
}

export type StartNextRoundResult = { ok: true; state: SessionState } | { ok: false; error: "round_in_progress" };

/** 前端按「下一題」／「重新開始」時呼叫；上一題（如果有）一定要先結束才能開新的。 */
export async function startNextRound(groupId: string, member: MemberIdentity): Promise<StartNextRoundResult> {
  const date = taipeiDateString();
  const dailyStats = await getOrCreateDailyStats(groupId, member.id, date);
  const existing = await getLatestRoundSettled(groupId, member.id, date);
  if (existing && existing.finishedAt === null) {
    return { ok: false, error: "round_in_progress" };
  }

  const recent = await prisma.wordleRound.findMany({
    where: { groupId, memberId: member.id },
    orderBy: { startedAt: "desc" },
    take: RECENT_ANSWERS_TO_AVOID,
    select: { answer: true },
  });
  const answer = pickRoundWord(recent.map((r) => r.answer));

  const streakPosition = dailyStats.currentCombo + 1;
  const timeLimitSeconds = timeLimitForStreak(streakPosition);
  const roundIndex = dailyStats.roundsPlayed + 1;

  const [round, refreshedStats] = await prisma.$transaction([
    prisma.wordleRound.create({
      data: {
        groupId,
        memberId: member.id,
        date,
        roundIndex,
        streakPosition,
        answer,
        timeLimitSeconds,
        guessDeadlineAt: new Date(Date.now() + timeLimitSeconds * 1000),
      },
    }),
    prisma.wordleDailyStats.update({
      where: { groupId_memberId_date: { groupId, memberId: member.id, date } },
      data: { roundsPlayed: roundIndex },
    }),
  ]);

  return { ok: true, state: { round: toRoundView(round), dailyStats: toDailyStatsView(refreshedStats) } };
}

export type SubmitGuessResult =
  | { ok: true; state: SessionState }
  | { ok: false; error: "invalid_word" | "already_finished" | "no_active_round" };

export async function submitGuess(
  groupId: string,
  member: MemberIdentity,
  rawGuess: string,
): Promise<SubmitGuessResult> {
  const guess = rawGuess.trim().toUpperCase();
  const date = taipeiDateString();
  const round = await getLatestRoundSettled(groupId, member.id, date);
  if (!round) {
    return { ok: false, error: "no_active_round" };
  }
  if (round.finishedAt !== null) {
    return { ok: false, error: "already_finished" };
  }
  if (!isValidGuess(guess)) {
    return { ok: false, error: "invalid_word" };
  }

  const guesses = Array.isArray(round.guesses) ? (round.guesses as string[]) : [];
  const nextGuesses = [...guesses, guess];
  const feedback = computeFeedback(round.answer, guess);
  const won = isWin(feedback);
  const exhausted = !won && nextGuesses.length >= MAX_GUESSES;
  const isFinished = won || exhausted;

  const dailyStats = await getOrCreateDailyStats(groupId, member.id, date);

  if (!isFinished) {
    // 還沒分勝負：只更新猜測紀錄，這一題的秒數不變，但這次猜測重新給滿倒數
    const updated = await prisma.wordleRound.update({
      where: { id: round.id },
      data: {
        guesses: nextGuesses,
        guessDeadlineAt: new Date(Date.now() + round.timeLimitSeconds * 1000),
      },
    });
    return { ok: true, state: { round: toRoundView(updated), dailyStats: toDailyStatsView(dailyStats) } };
  }

  const remainingMs = round.guessDeadlineAt ? round.guessDeadlineAt.getTime() - Date.now() : 0;
  const timeLimitMs = round.timeLimitSeconds * 1000;
  const base = baseScoreForGuesses(nextGuesses.length);
  const score = won ? roundScore(base, remainingMs, timeLimitMs, dailyStats.currentCombo) : 0;
  const breakdown: ScoreBreakdown | null = won
    ? {
        base,
        speedBonus: speedBonus(remainingMs, timeLimitMs),
        multiplier: comboMultiplier(dailyStats.currentCombo),
      }
    : null;
  const nextCombo = won ? dailyStats.currentCombo + 1 : 0;

  const [updatedRound, updatedStats] = await prisma.$transaction([
    prisma.wordleRound.update({
      where: { id: round.id },
      data: {
        guesses: nextGuesses,
        solved: won,
        finishedAt: new Date(),
        durationMs: Date.now() - round.startedAt.getTime(),
        score,
        guessDeadlineAt: null,
      },
    }),
    prisma.wordleDailyStats.update({
      where: { groupId_memberId_date: { groupId, memberId: member.id, date } },
      data: won
        ? {
            roundsSolved: { increment: 1 },
            bestScore: Math.max(dailyStats.bestScore, score),
            currentCombo: nextCombo,
            bestCombo: Math.max(dailyStats.bestCombo, nextCombo),
          }
        : { currentCombo: 0 },
    }),
  ]);

  return {
    ok: true,
    state: { round: toRoundView(updatedRound, breakdown), dailyStats: toDailyStatsView(updatedStats) },
  };
}

export interface LeaderboardEntry {
  memberId: string;
  displayName: string;
  bestScore: number;
  bestCombo: number;
  roundsSolved: number;
  roundsPlayed: number;
}

export interface Leaderboard {
  date: string;
  entries: LeaderboardEntry[];
}

/** 群組內今天的排行榜：依當天單回合最高分排序（不是累計總分），再依最佳連擊、解出題數。 */
export async function getLeaderboard(groupId: string): Promise<Leaderboard> {
  const date = taipeiDateString();
  const stats = await prisma.wordleDailyStats.findMany({
    where: { groupId, date, roundsPlayed: { gt: 0 } },
    include: { member: true },
    orderBy: [{ bestScore: "desc" }, { bestCombo: "desc" }, { roundsSolved: "desc" }],
  });

  return {
    date,
    entries: stats.map((s) => ({
      memberId: s.memberId,
      displayName: s.member.displayName ?? "神秘玩家",
      bestScore: s.bestScore,
      bestCombo: s.bestCombo,
      roundsSolved: s.roundsSolved,
      roundsPlayed: s.roundsPlayed,
    })),
  };
}

export interface AllTimeEntry {
  memberId: string;
  displayName: string;
  bestScore: number;
  bestCombo: number;
  date: string;
}

/** 史上最高分 TOP 3：不限日期，每人只計入自己締造過最高分的那一天。 */
export async function getAllTimeTopThree(groupId: string): Promise<AllTimeEntry[]> {
  const rows = await prisma.wordleDailyStats.findMany({
    where: { groupId, roundsPlayed: { gt: 0 } },
    include: { member: true },
    orderBy: [{ bestScore: "desc" }, { bestCombo: "desc" }],
  });

  const seen = new Set<string>();
  const top: AllTimeEntry[] = [];
  for (const row of rows) {
    if (seen.has(row.memberId)) continue;
    seen.add(row.memberId);
    top.push({
      memberId: row.memberId,
      displayName: row.member.displayName ?? "神秘玩家",
      bestScore: row.bestScore,
      bestCombo: row.bestCombo,
      date: row.date,
    });
    if (top.length === 3) break;
  }
  return top;
}
