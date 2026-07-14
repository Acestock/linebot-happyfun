import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LLMClient } from "../types";

const FALLBACK = "（預設文案）遊戲開始！";

describe("generateCopy", () => {
  let generateCopy: typeof import("../generator").generateCopy;

  beforeAll(async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "t";
    process.env.LINE_CHANNEL_SECRET = "s";
    process.env.DATABASE_URL = "postgresql://u:p@localhost:9/db";
    process.env.REDIS_URL = "redis://localhost:9";
    process.env.OPENAI_API_KEY = "test-key";
    ({ generateCopy } = await import("../generator"));
  });

  it("returns moderated LLM output on success", async () => {
    const client: LLMClient = { generate: vi.fn().mockResolvedValue("開局啦！大家衝🎉") };
    const text = await generateCopy("opening", { 遊戲: "終極密碼" }, FALLBACK, "g1", client);
    expect(text).toBe("開局啦！大家衝🎉");
  });

  it("falls back when the LLM throws (e.g. timeout)", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("timeout"));
    const text = await generateCopy("opening", {}, FALLBACK, "g1", { generate });
    expect(text).toBe(FALLBACK);
    expect(generate).toHaveBeenCalledTimes(2); // 兩次嘗試都失敗才降級
  });

  it("falls back when output keeps failing moderation", async () => {
    const generate = vi.fn().mockResolvedValue("這局比總統選舉還刺激");
    const text = await generateCopy("result", {}, FALLBACK, "g1", { generate });
    expect(text).toBe(FALLBACK);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("falls back when output is too long", async () => {
    const generate = vi.fn().mockResolvedValue("哈".repeat(500));
    const text = await generateCopy("result", {}, FALLBACK, "g1", { generate });
    expect(text).toBe(FALLBACK);
  });

  it("recovers when the second attempt passes moderation", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce("哈".repeat(500))
      .mockResolvedValueOnce("第二次就正常了🎊");
    const text = await generateCopy("result", {}, FALLBACK, "g1", { generate });
    expect(text).toBe("第二次就正常了🎊");
  });
});
