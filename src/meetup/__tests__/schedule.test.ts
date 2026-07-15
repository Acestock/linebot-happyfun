import { MeetupPhase } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { MEETUP_FLOW } from "../stateMachine";
import { buildScheduleLines, computePhaseBudgets } from "../schedule";

describe("computePhaseBudgets", () => {
  it("sums exactly to plannedMinutes for a round number", () => {
    const budgets = computePhaseBudgets(60);
    const total = Object.values(budgets).reduce((a, b) => a + b, 0);
    expect(total).toBe(60);
  });

  it("sums exactly to plannedMinutes for an awkward number (rounding edge case)", () => {
    for (const minutes of [7, 13, 37, 45, 91, 121]) {
      const budgets = computePhaseBudgets(minutes);
      const total = Object.values(budgets).reduce((a, b) => a + b, 0);
      expect(total).toBe(minutes);
    }
  });

  it("gives every MEETUP_FLOW phase a non-negative allocation", () => {
    const budgets = computePhaseBudgets(30);
    for (const phase of MEETUP_FLOW) {
      expect(budgets[phase]).toBeGreaterThanOrEqual(0);
    }
  });

  it("allocates the largest share to FREE_TALK for a typical duration", () => {
    const budgets = computePhaseBudgets(60);
    const max = Math.max(...Object.values(budgets));
    expect(budgets[MeetupPhase.FREE_TALK]).toBe(max);
  });
});

describe("buildScheduleLines", () => {
  it("produces one line per flow phase, each with the phase label and minutes", () => {
    const lines = buildScheduleLines(60);
    expect(lines).toHaveLength(MEETUP_FLOW.length);
    expect(lines.some((l) => l.includes("自由交流"))).toBe(true);
    expect(lines.every((l) => /\d+ 分鐘$/.test(l))).toBe(true);
  });
});
