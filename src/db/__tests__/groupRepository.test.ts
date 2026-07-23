import { describe, expect, it } from "vitest";
import { isValidLineGroupId } from "../groupRepository";

describe("isValidLineGroupId", () => {
  it("accepts a well-formed LINE group ID (C + 32 hex chars)", () => {
    expect(isValidLineGroupId("C1234567890abcdef1234567890abcdef")).toBe(true);
  });

  it("is case-insensitive on the hex portion", () => {
    expect(isValidLineGroupId("C1234567890ABCDEF1234567890ABCDEF")).toBe(true);
  });

  it("rejects our own internal Prisma UUID format", () => {
    expect(isValidLineGroupId("50027998-4732-48c8-8660-181433e8e9ba")).toBe(false);
  });

  it("rejects a user ID prefix (U) instead of a group prefix (C)", () => {
    expect(isValidLineGroupId("U1234567890abcdef1234567890abcdef")).toBe(false);
  });

  it("rejects wrong lengths", () => {
    expect(isValidLineGroupId("C123")).toBe(false);
    expect(isValidLineGroupId("C1234567890abcdef1234567890abcdeff")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidLineGroupId("")).toBe(false);
  });
});
