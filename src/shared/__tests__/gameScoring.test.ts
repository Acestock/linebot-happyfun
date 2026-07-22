import { describe, expect, it } from "vitest";
import {
  comboMultiplier,
  roundScore,
  speedBonus,
  STREAK_MIN_SECONDS,
  STREAK_RAMP_ROUNDS,
  STREAK_START_SECONDS,
  timeLimitForStreak,
} from "../gameScoring";

describe("timeLimitForStreak", () => {
  it("is the starting seconds at streak position 1", () => {
    expect(timeLimitForStreak(1)).toBe(STREAK_START_SECONDS);
  });

  it("is the minimum seconds at the ramp cap", () => {
    expect(timeLimitForStreak(STREAK_RAMP_ROUNDS)).toBe(STREAK_MIN_SECONDS);
  });

  it("stays at the minimum for any position beyond the ramp cap", () => {
    expect(timeLimitForStreak(STREAK_RAMP_ROUNDS + 1)).toBe(STREAK_MIN_SECONDS);
    expect(timeLimitForStreak(999)).toBe(STREAK_MIN_SECONDS);
  });

  it("decreases monotonically between position 1 and the ramp cap", () => {
    let prev = timeLimitForStreak(1);
    for (let n = 2; n <= STREAK_RAMP_ROUNDS; n++) {
      const cur = timeLimitForStreak(n);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });

  it("clamps below position 1 back up to the starting seconds", () => {
    expect(timeLimitForStreak(0)).toBe(STREAK_START_SECONDS);
    expect(timeLimitForStreak(-5)).toBe(STREAK_START_SECONDS);
  });
});

describe("speedBonus", () => {
  it("is the max bonus when the full time limit remains", () => {
    expect(speedBonus(10_000, 10_000)).toBe(20);
  });

  it("is zero when no time remains", () => {
    expect(speedBonus(0, 10_000)).toBe(0);
  });

  it("scales linearly with the remaining fraction", () => {
    expect(speedBonus(5_000, 10_000)).toBe(10);
  });

  it("clamps negative remaining time to zero bonus", () => {
    expect(speedBonus(-100, 10_000)).toBe(0);
  });

  it("respects a custom max bonus", () => {
    expect(speedBonus(10_000, 10_000, 50)).toBe(50);
  });
});

describe("comboMultiplier", () => {
  it("is 1x with no combo", () => {
    expect(comboMultiplier(0)).toBe(1);
  });

  it("increases by the step per combo point", () => {
    expect(comboMultiplier(1)).toBeCloseTo(1.15);
    expect(comboMultiplier(3)).toBeCloseTo(1.45);
  });

  it("caps the multiplier at the configured combo cap", () => {
    expect(comboMultiplier(10)).toBeCloseTo(comboMultiplier(20));
  });

  it("treats negative combo as zero", () => {
    expect(comboMultiplier(-5)).toBe(1);
  });
});

describe("roundScore", () => {
  it("combines base score, speed bonus, and combo multiplier", () => {
    // base 100, full time remaining (+20 speed bonus), no combo yet (1x) -> 120
    expect(roundScore(100, 10_000, 10_000, 0)).toBe(120);
  });

  it("scales up with combo", () => {
    const noCombo = roundScore(100, 10_000, 10_000, 0);
    const withCombo = roundScore(100, 10_000, 10_000, 5);
    expect(withCombo).toBeGreaterThan(noCombo);
  });

  it("is lower when the guess was submitted with little time left", () => {
    const fast = roundScore(100, 9_000, 10_000, 0);
    const slow = roundScore(100, 500, 10_000, 0);
    expect(slow).toBeLessThan(fast);
  });
});
