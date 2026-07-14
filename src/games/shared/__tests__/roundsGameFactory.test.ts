import { describe, expect, it } from "vitest";
import { pickCategoryHint, pickRounds } from "../roundsGameFactory";
import type { Round } from "../rounds";

const bank: Round[] = Array.from({ length: 10 }, (_, i) => ({
  question: `Q${i}`,
  answers: [`A${i}`],
}));

describe("pickRounds", () => {
  it("excludes recently-asked questions when enough fresh ones remain", () => {
    const avoid = new Set(["Q0", "Q1", "Q2", "Q3", "Q4", "Q5"]); // 剩 4 題新的
    for (let i = 0; i < 20; i++) {
      const picked = pickRounds(bank, 3, avoid);
      expect(picked).toHaveLength(3);
      for (const round of picked) {
        expect(avoid.has(round.question)).toBe(false);
      }
    }
  });

  it("falls back to allowing repeats when too few fresh questions remain", () => {
    const avoid = new Set(bank.slice(0, 9).map((r) => r.question)); // 只剩 1 題新的，要 5 題
    const picked = pickRounds(bank, 5, avoid);
    expect(picked).toHaveLength(5); // 遊戲還是開得起來，即使代表要重複
  });

  it("never returns more than the bank size", () => {
    const picked = pickRounds(bank, 100, new Set());
    expect(picked).toHaveLength(bank.length);
  });
});

describe("pickCategoryHint", () => {
  it("returns undefined when no pool is given", () => {
    expect(pickCategoryHint(undefined)).toBeUndefined();
    expect(pickCategoryHint([])).toBeUndefined();
  });

  it("picks at most 3 categories, all from the pool", () => {
    const pool = ["地理", "歷史", "科學", "運動", "美食"];
    for (let i = 0; i < 20; i++) {
      const hint = pickCategoryHint(pool);
      expect(hint).toBeDefined();
      const picked = hint!.split("、");
      expect(picked.length).toBeLessThanOrEqual(3);
      for (const p of picked) expect(pool).toContain(p);
    }
  });

  it("returns all categories joined when the pool is smaller than 3", () => {
    expect(pickCategoryHint(["地理", "歷史"])).toMatch(/^(地理、歷史|歷史、地理)$/);
  });
});
