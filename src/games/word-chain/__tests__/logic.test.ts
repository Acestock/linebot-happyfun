import { describe, expect, it } from "vitest";
import {
  MAX_CHIMES_PER_SESSION,
  applyWord,
  createWordChainState,
  isSummonSummary,
  isWordCandidate,
} from "../logic";

const fixedRand = () => 0; // gap 固定為最小值 4

describe("word-chain logic", () => {
  it("recognizes valid 2-8 char Han word candidates", () => {
    expect(isWordCandidate("快樂")).toBe(true);
    expect(isWordCandidate("快樂無比每一天")).toBe(true);
    expect(isWordCandidate("a")).toBe(false);
    expect(isWordCandidate("快")).toBe(false); // 單字不算
    expect(isWordCandidate("hello")).toBe(false);
    expect(isWordCandidate("快樂123")).toBe(false);
  });

  it("recognizes summon keywords", () => {
    expect(isSummonSummary("總結")).toBe(true);
    expect(isSummonSummary("接龍總結")).toBe(true);
    expect(isSummonSummary("快樂")).toBe(false);
  });

  it("accepts a word whose first character matches the previous word's last character", () => {
    const state = createWordChainState("快樂", fixedRand);
    const { state: next, outcome } = applyWord(state, "m1", "小明", "樂觀", fixedRand);
    expect(outcome).toMatchObject({ type: "accepted", word: "樂觀" });
    expect(next.chain).toEqual(["快樂", "樂觀"]);
    expect(next.guessesByMember).toEqual({ m1: 1 });
  });

  it("rejects a word that doesn't start with the required character", () => {
    const state = createWordChainState("快樂", fixedRand);
    const { state: next, outcome } = applyWord(state, "m1", "小明", "旅行", fixedRand);
    expect(outcome).toEqual({ type: "rejected", reason: "wrong_start", expectedStart: "樂" });
    expect(next.chain).toEqual(["快樂"]); // chain 沒變
  });

  it("rejects a word that was already used", () => {
    let state = createWordChainState("快樂", fixedRand);
    state = applyWord(state, "m1", "小明", "樂觀", fixedRand).state;
    // 接一個字首是「觀」的詞，但故意重複用過的「快樂」不行（字首不合也一起驗證不到，換個真的重複案例）
    state = applyWord(state, "m1", "小明", "觀光", fixedRand).state; // 光
    const dup = applyWord(state, "m2", "阿凱", "觀光", fixedRand);
    expect(dup.outcome).toEqual({ type: "rejected", reason: "duplicate", expectedStart: "光" });
  });

  it("chimes in after the configured gap and caps chimes per session", () => {
    let state = createWordChainState("快樂", fixedRand); // nextChimeAfter = 4 (min gap)
    const words = ["樂觀", "觀光", "光明", "明天", "天空", "空氣", "氣球", "球場", "場地", "地球"];
    let chimeCount = 0;
    for (const w of words) {
      const r = applyWord(state, "m1", "小明", w, fixedRand);
      if (r.outcome.type === "accepted" && r.outcome.shouldChime) chimeCount++;
      state = r.state;
    }
    expect(chimeCount).toBeGreaterThan(0);
    expect(state.chimesUsed).toBeLessThanOrEqual(MAX_CHIMES_PER_SESSION);
  });

  it("tracks per-member contribution counts", () => {
    let state = createWordChainState("快樂", fixedRand);
    state = applyWord(state, "a", "A", "樂觀", fixedRand).state;
    state = applyWord(state, "b", "B", "觀光", fixedRand).state;
    state = applyWord(state, "a", "A", "光明", fixedRand).state;
    expect(state.guessesByMember).toEqual({ a: 2, b: 1 });
  });
});
