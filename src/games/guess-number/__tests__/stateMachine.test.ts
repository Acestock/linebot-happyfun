import { describe, expect, it } from "vitest";
import { applyGuess, createState, parseGuess } from "../stateMachine";

describe("guess-number state machine", () => {
  describe("createState", () => {
    it("creates a state with the answer inside the range", () => {
      for (let i = 0; i < 50; i++) {
        const state = createState({ min: 1, max: 100 });
        expect(state.answer).toBeGreaterThanOrEqual(1);
        expect(state.answer).toBeLessThanOrEqual(100);
      }
    });

    it("accepts an injected answer for deterministic tests", () => {
      const state = createState({ min: 1, max: 100 }, 42);
      expect(state.answer).toBe(42);
      expect(state.lowerBound).toBe(1);
      expect(state.upperBound).toBe(100);
      expect(state.attempts).toBe(0);
    });

    it("rejects an injected answer outside the range", () => {
      expect(() => createState({ min: 1, max: 100 }, 101)).toThrow();
    });
  });

  describe("applyGuess", () => {
    it("narrows the lower bound on a too-low guess", () => {
      const state = createState({ min: 1, max: 100 }, 70);
      const { state: next, outcome } = applyGuess(state, "m1", 30);
      expect(outcome).toEqual({ type: "too_low", lowerBound: 31, upperBound: 100 });
      expect(next.lowerBound).toBe(31);
      expect(next.attempts).toBe(1);
      expect(next.guessesByMember).toEqual({ m1: 1 });
    });

    it("narrows the upper bound on a too-high guess", () => {
      const state = createState({ min: 1, max: 100 }, 70);
      const { state: next, outcome } = applyGuess(state, "m1", 90);
      expect(outcome).toEqual({ type: "too_high", lowerBound: 1, upperBound: 89 });
      expect(next.upperBound).toBe(89);
    });

    it("detects a win and counts attempts across members", () => {
      let state = createState({ min: 1, max: 100 }, 70);
      state = applyGuess(state, "m1", 50).state;
      state = applyGuess(state, "m2", 90).state;
      const { state: final, outcome } = applyGuess(state, "m1", 70);
      expect(outcome).toEqual({ type: "win", attempts: 3 });
      expect(final.guessesByMember).toEqual({ m1: 2, m2: 1 });
    });

    it("rejects guesses outside the current narrowed range without consuming an attempt", () => {
      let state = createState({ min: 1, max: 100 }, 70);
      state = applyGuess(state, "m1", 50).state; // range now 51~100
      const { state: next, outcome } = applyGuess(state, "m2", 20);
      expect(outcome).toEqual({ type: "out_of_range", lowerBound: 51, upperBound: 100 });
      expect(next.attempts).toBe(1);
      expect(next.guessesByMember).toEqual({ m1: 1 });
    });

    it("still allows winning when the range narrows to a single number", () => {
      let state = createState({ min: 1, max: 3 }, 2);
      state = applyGuess(state, "m1", 1).state; // range 2~3
      state = applyGuess(state, "m2", 3).state; // range 2~2
      const { outcome } = applyGuess(state, "m3", 2);
      expect(outcome).toEqual({ type: "win", attempts: 3 });
    });
  });

  describe("parseGuess", () => {
    it("parses plain numbers with surrounding whitespace", () => {
      expect(parseGuess("42")).toBe(42);
      expect(parseGuess("  7 ")).toBe(7);
    });

    it("rejects non-numeric chatter so the bot stays silent", () => {
      expect(parseGuess("hello")).toBeNull();
      expect(parseGuess("42 猜這個")).toBeNull();
      expect(parseGuess("4.2")).toBeNull();
      expect(parseGuess("-5")).toBeNull();
      expect(parseGuess("")).toBeNull();
    });
  });
});
