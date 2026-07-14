import { describe, expect, it } from "vitest";
import { moderateCopy } from "../moderation";

describe("moderateCopy", () => {
  it("passes normal persona copy through, trimmed", () => {
    expect(moderateCopy("  哇賽開局啦！大家快來猜🎉  ")).toBe("哇賽開局啦！大家快來猜🎉");
  });

  it("strips wrapping quotes the model sometimes adds", () => {
    expect(moderateCopy("「開局啦，手速慢的等著哭」")).toBe("開局啦，手速慢的等著哭");
  });

  it("rejects empty output", () => {
    expect(moderateCopy("   ")).toBeNull();
  });

  it("rejects output over the length cap", () => {
    expect(moderateCopy("哈".repeat(201))).toBeNull();
  });

  it("rejects blacklisted political words", () => {
    expect(moderateCopy("這局比總統選舉還刺激")).toBeNull();
  });

  it("rejects vulgar words", () => {
    expect(moderateCopy("猜不中是智障嗎")).toBeNull();
  });

  it("rejects phone-number-looking strings", () => {
    expect(moderateCopy("快打給我 0912345678")).toBeNull();
  });

  it("rejects URLs", () => {
    expect(moderateCopy("來這裡看答案 https://evil.example.com")).toBeNull();
  });
});
