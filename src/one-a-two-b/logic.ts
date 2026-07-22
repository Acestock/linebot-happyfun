/**
 * 1A2B（猜數字密碼／Bulls and Cows）純邏輯（無 I/O）— 跟 src/wordle/logic.ts 同樣的角色，
 * 也刻意保持獨立不共用：manager.ts 負責 DB，這裡只做資料運算。
 *
 * 規則：密碼是 4 位不重複數字，玩家猜一組同樣 4 位不重複的數字，每位數字回饋
 * correct（位置也對，即 A）／present（數字有出現、位置不對，即 B）／absent（沒出現）。
 * 猜出全部 correct 就贏。
 */

export const MAX_GUESSES = 10;
export const DIGITS = 4;

export type DigitFeedback = "correct" | "present" | "absent";

const DIGIT_POOL = "0123456789".split("");

export function isValidGuess(guess: string): boolean {
  return new RegExp(`^\\d{${DIGITS}}$`).test(guess) && new Set(guess).size === DIGITS;
}

/**
 * 跟 Wordle 同一套兩輪演算法：第一輪先標記完全命中（位置也對）的數字，第二輪處理
 * 「數字對但位置錯」，並扣掉第一輪已用掉的次數，避免重複計數。密碼本身數字不重複，
 * 但沿用一般化演算法，猜測端萬一有重複數字時也不會誤判。
 */
export function computeFeedback(answer: string, guess: string): DigitFeedback[] {
  const answerDigits = answer.split("");
  const guessDigits = guess.split("");
  const feedback: DigitFeedback[] = new Array(guessDigits.length).fill("absent");

  const remaining: Record<string, number> = {};
  for (let i = 0; i < answerDigits.length; i++) {
    if (guessDigits[i] === answerDigits[i]) {
      feedback[i] = "correct";
    } else {
      remaining[answerDigits[i]] = (remaining[answerDigits[i]] ?? 0) + 1;
    }
  }

  for (let i = 0; i < guessDigits.length; i++) {
    if (feedback[i] === "correct") continue;
    const digit = guessDigits[i];
    if ((remaining[digit] ?? 0) > 0) {
      feedback[i] = "present";
      remaining[digit] -= 1;
    }
  }

  return feedback;
}

export function isWin(feedback: DigitFeedback[]): boolean {
  return feedback.every((f) => f === "correct");
}

function randomShuffle(items: string[]): string[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 每個人可以當天連續開很多題，不需要日期 determinism 了——密碼從 0-9 洗牌取前 DIGITS
 * 位直接生成，避開最近 recentAnswers 出現過的密碼（洗牌空間夠大，通常第一次就會避開）。
 */
export function pickRoundAnswer(recentAnswers: string[]): string {
  const avoid = new Set(recentAnswers);

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = randomShuffle(DIGIT_POOL).slice(0, DIGITS).join("");
    if (!avoid.has(candidate)) return candidate;
  }
  return randomShuffle(DIGIT_POOL).slice(0, DIGITS).join("");
}

/**
 * 猜越少次分數越高，最後一次猜中封底分。跟 speedBonus／comboMultiplier
 * （src/shared/gameScoring.ts）疊加算出最終 roundScore。
 */
export function baseScoreForGuesses(guessesUsed: number): number {
  return Math.max(19, 100 - (guessesUsed - 1) * 9);
}
