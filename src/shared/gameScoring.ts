/**
 * Wordle / 1A2B 共用的計分純函式（無 I/O）。這裡只放跟「猜測次數上限」無關的
 * 通用數學——時限隨連續挑戰題數遞減、手速加成、連擊倍率——各遊戲自己的
 * baseScore(guessesUsed) 公式留在各自的 logic.ts。
 */

export const STREAK_START_SECONDS = 60;
export const STREAK_MIN_SECONDS = 10;
export const STREAK_RAMP_ROUNDS = 10;

/**
 * streakPosition：本回合是這次連續挑戰（combo 不中斷）中的第幾題，1-indexed。
 * 第 1 題 60 秒、線性遞減到第 10 題（含以後）固定 10 秒。
 */
export function timeLimitForStreak(streakPosition: number): number {
  const n = Math.min(Math.max(streakPosition, 1), STREAK_RAMP_ROUNDS);
  const t =
    STREAK_START_SECONDS -
    ((n - 1) * (STREAK_START_SECONDS - STREAK_MIN_SECONDS)) / (STREAK_RAMP_ROUNDS - 1);
  return Math.round(t);
}

/** remainingMs：贏的那次猜測送出時，離時限還剩多少毫秒。剩越多、加成越高。 */
export function speedBonus(remainingMs: number, timeLimitMs: number, maxBonus = 20): number {
  const fraction = Math.max(0, Math.min(1, remainingMs / timeLimitMs));
  return Math.round(maxBonus * fraction);
}

/** comboBefore：進入本回合之前已經連續答對幾題。 */
export function comboMultiplier(comboBefore: number, step = 0.15, cap = 10): number {
  return 1 + step * Math.min(Math.max(comboBefore, 0), cap);
}

export function roundScore(
  baseScore: number,
  remainingMs: number,
  timeLimitMs: number,
  comboBefore: number,
): number {
  return Math.round((baseScore + speedBonus(remainingMs, timeLimitMs)) * comboMultiplier(comboBefore));
}
