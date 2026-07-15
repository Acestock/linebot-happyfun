import { describe, expect, it } from "vitest";
import {
  computeFeedback,
  isValidGuess,
  isWin,
  MAX_GUESSES,
  pickDailyWord,
  WORD_LIST,
} from "../logic";

describe("computeFeedback", () => {
  it("marks every letter correct for an exact match", () => {
    expect(computeFeedback("CRANE", "CRANE")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("marks letters absent when they don't appear in the answer at all", () => {
    expect(computeFeedback("CRANE", "SPOIL")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("marks a letter present when it's in the answer but the wrong position", () => {
    // answer RANCE, guess CRANE: C is in RANCE but not at position 0
    expect(computeFeedback("RANCE", "CRANE")[0]).toBe("present");
  });

  it("marks a duplicated guess letter present up to the count available in the answer, no further", () => {
    // answer ERASE has two E's (index 0 and 4); guess SPEED also has two E's (index 2 and 3),
    // neither in the right position — both should be "present" since the answer has enough E's
    // to cover both. A naive per-letter-only check (ignoring counts) would still get this right,
    // but a naive "mark every matching letter correct" implementation would get it wrong.
    const feedback = computeFeedback("ERASE", "SPEED");
    expect(feedback).toEqual(["present", "absent", "present", "present", "absent"]);
  });

  it("caps duplicated present matches at the count actually available in the answer", () => {
    // answer CRANE has exactly one E; guess ELDER has two E's (index 0 and 3) — only one
    // should be marked present, the other must be absent even though the letter exists once.
    const feedback = computeFeedback("CRANE", "ELDER");
    const eCount = feedback.filter((f, i) => "ELDER"[i] === "E" && f !== "absent").length;
    expect(eCount).toBe(1);
  });

  it("handles a letter that is both an exact match and a present match in the same guess", () => {
    // answer APPLE (two P's), guess PAPER (two P's): one P lands exactly (index 2),
    // the other P is present-but-misplaced (index 0) — both should be reported, not just one
    const feedback = computeFeedback("APPLE", "PAPER");
    expect(feedback).toEqual(["present", "present", "correct", "present", "absent"]);
  });

  it("is case-insensitive", () => {
    expect(computeFeedback("crane", "CRANE")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });
});

describe("isWin", () => {
  it("returns true only when every letter is correct", () => {
    expect(isWin(["correct", "correct", "correct", "correct", "correct"])).toBe(true);
    expect(isWin(["correct", "present", "correct", "correct", "correct"])).toBe(false);
    expect(isWin(["absent", "absent", "absent", "absent", "absent"])).toBe(false);
  });
});

describe("isValidGuess", () => {
  it("accepts words in the word list, case-insensitively", () => {
    expect(isValidGuess("CRANE")).toBe(true);
    expect(isValidGuess("crane")).toBe(true);
  });

  it("rejects words not in the word list", () => {
    expect(isValidGuess("ZZZZZ")).toBe(false);
    expect(isValidGuess("ABCDE")).toBe(false);
  });
});

describe("WORD_LIST", () => {
  it("only contains unique 5-letter uppercase words", () => {
    expect(WORD_LIST.length).toBeGreaterThan(100);
    for (const word of WORD_LIST) {
      expect(word).toMatch(/^[A-Z]{5}$/);
    }
    expect(new Set(WORD_LIST).size).toBe(WORD_LIST.length);
  });
});

describe("MAX_GUESSES", () => {
  it("is 6, the classic Wordle limit", () => {
    expect(MAX_GUESSES).toBe(6);
  });
});

describe("pickDailyWord", () => {
  it("always returns a word from the word list", () => {
    const word = pickDailyWord("2026-07-16", []);
    expect(WORD_LIST).toContain(word);
  });

  it("is deterministic for the same date", () => {
    const a = pickDailyWord("2026-07-16", []);
    const b = pickDailyWord("2026-07-16", []);
    expect(a).toBe(b);
  });

  it("avoids words in the recent-answers list when alternatives exist", () => {
    const word = pickDailyWord("2026-07-16", []);
    const again = pickDailyWord("2026-07-16", [word]);
    expect(again).not.toBe(word);
  });

  it("falls back to allowing repeats if the entire word list was recently used", () => {
    const word = pickDailyWord("2026-07-16", [...WORD_LIST]);
    expect(WORD_LIST).toContain(word);
  });
});
