import { describe, expect, it } from "vitest";
import {
  applyRoundGuess,
  buildScoreboard,
  createRoundsState,
  isCorrectAnswer,
  normalizeAnswer,
  skipRound,
} from "../rounds";
import type { Round } from "../rounds";

const rounds: Round[] = [
  { question: "🚢🧊💑💀 猜一部電影", answers: ["鐵達尼號", "鐵達尼"] },
  { question: "台灣最高的山是？", answers: ["玉山"] },
  { question: "一年有幾個月？", answers: ["12", "十二"] },
];

describe("normalizeAnswer / isCorrectAnswer", () => {
  it("normalizes fullwidth, whitespace, punctuation and case", () => {
    expect(normalizeAnswer("鐵達尼 號！")).toBe("鐵達尼號");
    expect(normalizeAnswer("ＡＢＣ")).toBe("abc");
  });

  it("matches exact and partial (>=2 char) answers", () => {
    expect(isCorrectAnswer("鐵達尼號", rounds[0])).toBe(true);
    expect(isCorrectAnswer("鐵達尼", rounds[0])).toBe(true);
    expect(isCorrectAnswer("是鐵達尼號沒錯", rounds[0])).toBe(true);
  });

  it("rejects short noise like a single punctuation mark", () => {
    expect(isCorrectAnswer("！", rounds[0])).toBe(false);
    expect(isCorrectAnswer("", rounds[0])).toBe(false);
  });

  it("rejects wrong answers", () => {
    expect(isCorrectAnswer("阿凡達", rounds[0])).toBe(false);
  });

  it("accepts any listed alternative answer", () => {
    expect(isCorrectAnswer("12", rounds[2])).toBe(true);
    expect(isCorrectAnswer("十二", rounds[2])).toBe(true);
    expect(isCorrectAnswer("13", rounds[2])).toBe(false);
  });
});

describe("applyRoundGuess", () => {
  it("advances to the next round on a correct guess", () => {
    const state = createRoundsState(rounds);
    const { state: next, outcome } = applyRoundGuess(state, "m1", "小明", "鐵達尼號");
    expect(outcome).toEqual({
      type: "correct",
      answer: "鐵達尼號",
      finished: false,
      nextQuestion: rounds[1].question,
    });
    expect(next.idx).toBe(1);
    expect(next.guessesByMember).toEqual({ m1: 1 });
    expect(next.namesById).toEqual({ m1: "小明" });
  });

  it("does not advance on a wrong guess", () => {
    const state = createRoundsState(rounds);
    const { state: next, outcome } = applyRoundGuess(state, "m1", "小明", "阿凡達");
    expect(outcome).toEqual({ type: "wrong" });
    expect(next.idx).toBe(0);
    expect(next.guessesByMember).toEqual({});
  });

  it("marks finished after the last round is answered", () => {
    let state = createRoundsState(rounds);
    state = applyRoundGuess(state, "m1", "小明", "鐵達尼號").state;
    state = applyRoundGuess(state, "m1", "小明", "玉山").state;
    const { outcome } = applyRoundGuess(state, "m1", "小明", "12");
    expect(outcome.type).toBe("correct");
    expect(outcome).toMatchObject({ finished: true, nextQuestion: undefined });
  });

  it("accumulates per-member score across rounds", () => {
    let state = createRoundsState(rounds);
    state = applyRoundGuess(state, "m1", "小明", "鐵達尼號").state;
    state = applyRoundGuess(state, "m2", "阿凱", "玉山").state;
    state = applyRoundGuess(state, "m1", "小明", "12").state;
    expect(state.guessesByMember).toEqual({ m1: 2, m2: 1 });
  });
});

describe("skipRound", () => {
  it("advances without awarding a point", () => {
    const state = createRoundsState(rounds);
    const { state: next, outcome } = skipRound(state);
    expect(outcome).toEqual({
      type: "skipped",
      answer: "鐵達尼號",
      finished: false,
      nextQuestion: rounds[1].question,
    });
    expect(next.idx).toBe(1);
    expect(next.guessesByMember).toEqual({});
  });
});

describe("buildScoreboard", () => {
  it("ranks members by score with medals", () => {
    let state = createRoundsState(rounds);
    state = applyRoundGuess(state, "m1", "小明", "鐵達尼號").state;
    state = applyRoundGuess(state, "m2", "阿凱", "玉山").state;
    state = applyRoundGuess(state, "m1", "小明", "12").state;
    const { text, winnerId } = buildScoreboard(state);
    expect(winnerId).toBe("m1");
    expect(text).toContain("🥇 小明：2 分");
    expect(text).toContain("🥈 阿凱：1 分");
  });

  it("handles nobody scoring", () => {
    const { text, winnerId } = buildScoreboard(createRoundsState(rounds));
    expect(winnerId).toBeNull();
    expect(text).toContain("沒有人得分");
  });
});
