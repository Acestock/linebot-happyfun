import { describe, expect, it } from "vitest";
import {
  computeMissingCheckins,
  computeTopEntry,
  computeTotalMessages,
  incrementMessageCount,
} from "../stats";

describe("computeMissingCheckins", () => {
  const members = [
    { id: "a", displayName: "小明" },
    { id: "b", displayName: "小華" },
    { id: "c", displayName: null },
  ];

  it("excludes members who already checked in", () => {
    const result = computeMissingCheckins(members, ["a"]);
    expect(result.names).toEqual(["小華", "神祕成員"]);
    expect(result.totalMissing).toBe(2);
  });

  it("returns everyone when nobody has checked in", () => {
    const result = computeMissingCheckins(members, []);
    expect(result.totalMissing).toBe(3);
  });

  it("returns empty when everyone checked in", () => {
    const result = computeMissingCheckins(members, ["a", "b", "c"]);
    expect(result).toEqual({ names: [], totalMissing: 0 });
  });

  it("caps the displayed names at the given limit but keeps the true total", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, displayName: `成員${i}` }));
    const result = computeMissingCheckins(many, [], 15);
    expect(result.names).toHaveLength(15);
    expect(result.totalMissing).toBe(20);
  });
});

describe("computeTotalMessages", () => {
  it("sums all counts", () => {
    expect(computeTotalMessages({ a: 3, b: 5, c: 2 })).toBe(10);
  });

  it("returns 0 for an empty map", () => {
    expect(computeTotalMessages({})).toBe(0);
  });
});

describe("computeTopEntry", () => {
  it("finds the member with the highest count", () => {
    expect(computeTopEntry({ a: 3, b: 9, c: 5 })).toEqual({ memberId: "b", count: 9 });
  });

  it("returns null for an empty map", () => {
    expect(computeTopEntry({})).toBeNull();
  });

  it("handles a single entry", () => {
    expect(computeTopEntry({ solo: 1 })).toEqual({ memberId: "solo", count: 1 });
  });
});

describe("incrementMessageCount", () => {
  it("starts a new counter at 1", () => {
    expect(incrementMessageCount({}, "a")).toEqual({ a: 1 });
  });

  it("increments an existing counter", () => {
    expect(incrementMessageCount({ a: 4 }, "a")).toEqual({ a: 5 });
  });

  it("does not mutate the original object", () => {
    const original = { a: 1 };
    incrementMessageCount(original, "a");
    expect(original).toEqual({ a: 1 });
  });

  it("leaves other members' counts untouched", () => {
    expect(incrementMessageCount({ a: 1, b: 2 }, "b")).toEqual({ a: 1, b: 3 });
  });
});
