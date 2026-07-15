import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LLMClient } from "../../persona/types";

describe("generateAiIcebreaker", () => {
  let generateAiIcebreaker: typeof import("../icebreakerAI").generateAiIcebreaker;

  beforeAll(async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "t";
    process.env.LINE_CHANNEL_SECRET = "s";
    process.env.DATABASE_URL = "postgresql://u:p@localhost:9/db";
    process.env.REDIS_URL = "redis://localhost:9";
    process.env.OPENAI_API_KEY = "test-key";
    ({ generateAiIcebreaker } = await import("../icebreakerAI"));
  });

  it("returns moderated LLM output on success", async () => {
    const client: LLMClient = { generate: vi.fn().mockResolvedValue("這次「新創圈交流」裡，最近做的最有成就感的事是什麼？") };
    const question = await generateAiIcebreaker("新創圈交流", "輕鬆", [], client);
    expect(question).toBe("這次「新創圈交流」裡，最近做的最有成就感的事是什麼？");
  });

  it("passes previously-used questions into the prompt to avoid repeats", async () => {
    const generate = vi.fn().mockResolvedValue("換一題囉！");
    await generateAiIcebreaker("老同學聚餐", "活潑", ["上次問過的題目"], { generate });
    const userPrompt = generate.mock.calls[0][0].userPrompt as string;
    expect(userPrompt).toContain("上次問過的題目");
  });

  it("falls back to null when the LLM throws (e.g. timeout)", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("timeout"));
    const question = await generateAiIcebreaker("主題", "輕鬆", [], { generate });
    expect(question).toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("falls back to null when output keeps failing moderation", async () => {
    const generate = vi.fn().mockResolvedValue("這題跟總統選舉有關");
    const question = await generateAiIcebreaker("主題", "輕鬆", [], { generate });
    expect(question).toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("recovers when the second attempt passes moderation", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce("這題跟總統選舉有關")
      .mockResolvedValueOnce("第二次就正常了，最近有什麼新發現？");
    const question = await generateAiIcebreaker("主題", "輕鬆", [], { generate });
    expect(question).toBe("第二次就正常了，最近有什麼新發現？");
  });

  it("returns null immediately when there is no OpenAI API key configured", async () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    vi.resetModules();
    const { generateAiIcebreaker: generateNoKey } = await import("../icebreakerAI");
    const generate = vi.fn().mockResolvedValue("不該被呼叫");
    const question = await generateNoKey("主題", "輕鬆", [], { generate });
    expect(question).toBeNull();
    expect(generate).not.toHaveBeenCalled();
    process.env.OPENAI_API_KEY = original;
    vi.resetModules();
  });
});
