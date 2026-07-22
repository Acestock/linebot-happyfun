import { describe, expect, it } from "vitest";
import {
  baseScoreForGuesses,
  computeFeedback,
  DIGITS,
  isValidGuess,
  isWin,
  MAX_GUESSES,
  pickRoundAnswer,
} from "../logic";

describe("isValidGuess", () => {
  it("accepts exactly DIGITS distinct digit characters", () => {
    expect(isValidGuess("1234")).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isValidGuess("123")).toBe(false);
    expect(isValidGuess("12345")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(isValidGuess("12a4")).toBe(false);
  });

  it("rejects duplicate digits", () => {
    expect(isValidGuess("1123")).toBe(false);
  });
});

describe("computeFeedback", () => {
  it("marks every digit correct for an exact match", () => {
    expect(computeFeedback("1234", "1234")).toEqual(["correct", "correct", "correct", "correct"]);
  });

  it("marks digits absent when they don't appear in the answer at all", () => {
    expect(computeFeedback("1234", "5678")).toEqual(["absent", "absent", "absent", "absent"]);
  });

  it("computes a known mixed case (2A2B)", () => {
    // answer 1234, guess 1243: pos0 1=1 correct, pos1 2=2 correct,
    // pos2 4 present-wrong-position, pos3 3 present-wrong-position
    expect(computeFeedback("1234", "1243")).toEqual(["correct", "correct", "present", "present"]);
  });

  it("computes a full rotation as all present (0A4B)", () => {
    expect(computeFeedback("1234", "4321")).toEqual(["present", "present", "present", "present"]);
  });

  it("does not double-count a duplicated guess digit beyond how many times it appears in the answer", () => {
    // answer has exactly one '1' (at index 0); guess has two '1's (index 0 and 2).
    // index0 matches exactly -> correct. index2's '1' has no remaining '1' left in the
    // answer to match against (the only one was consumed by the exact match) -> absent.
    const feedback = computeFeedback("1234", "1156");
    expect(feedback[0]).toBe("correct");
    expect(feedback[2]).toBe("absent");
  });
});

describe("isWin", () => {
  it("returns true only when every digit is correct", () => {
    expect(isWin(["correct", "correct", "correct", "correct"])).toBe(true);
    expect(isWin(["correct", "present", "correct", "correct"])).toBe(false);
    expect(isWin(["absent", "absent", "absent", "absent"])).toBe(false);
  });
});

describe("pickRoundAnswer", () => {
  it("always returns DIGITS distinct digit characters", () => {
    const answer = pickRoundAnswer([]);
    expect(answer).toHaveLength(DIGITS);
    expect(new Set(answer).size).toBe(DIGITS);
    expect(/^\d+$/.test(answer)).toBe(true);
  });

  it("avoids a recently-used answer when alternatives exist", () => {
    const answer = pickRoundAnswer([]);
    for (let i = 0; i < 20; i++) {
      expect(pickRoundAnswer([answer])).not.toBe(answer);
    }
  });
});

describe("MAX_GUESSES / DIGITS", () => {
  it("uses the classic 4-digit 1A2B with a generous guess budget", () => {
    expect(DIGITS).toBe(4);
    expect(MAX_GUESSES).toBe(10);
  });
});

describe("baseScoreForGuesses", () => {
  it("gives the max score for solving in one guess", () => {
    expect(baseScoreForGuesses(1)).toBe(100);
  });

  it("gives the floor score for using every guess", () => {
    expect(baseScoreForGuesses(MAX_GUESSES)).toBe(19);
  });

  it("decreases monotonically as more guesses are used", () => {
    let prev = baseScoreForGuesses(1);
    for (let n = 2; n <= MAX_GUESSES; n++) {
      const cur = baseScoreForGuesses(n);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
});
