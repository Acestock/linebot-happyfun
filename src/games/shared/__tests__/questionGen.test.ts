import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LLMClient } from "../../../persona/types";

describe("generateRounds", () => {
  let generateRounds: typeof import("../questionGen").generateRounds;

  beforeAll(async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "t";
    process.env.LINE_CHANNEL_SECRET = "s";
    process.env.DATABASE_URL = "postgresql://u:p@localhost:9/db";
    process.env.REDIS_URL = "redis://localhost:9";
    process.env.OPENAI_API_KEY = "test-key";
    ({ generateRounds } = await import("../questionGen"));
  });

  it("parses a well-formed JSON array into rounds", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify([
        { question: "台灣最高的山？", answers: ["玉山"] },
        { question: "一年幾個月？", answers: ["12", "十二"] },
        { question: "水的化學式？", answers: ["H2O"] },
      ]),
    );
    const rounds = await generateRounds("出題", 3, {}, { generate });
    expect(rounds).toEqual([
      { question: "台灣最高的山？", answers: ["玉山"] },
      { question: "一年幾個月？", answers: ["12", "十二"] },
      { question: "水的化學式？", answers: ["H2O"] },
    ]);
  });

  it("strips a ```json code fence before parsing", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue('```json\n[{"question":"Q1","answers":["A1"]}]\n```');
    const rounds = await generateRounds("出題", 1, {}, { generate });
    expect(rounds).toEqual([{ question: "Q1", answers: ["A1"] }]);
  });

  it("returns null on invalid JSON so the caller can fall back", async () => {
    const generate = vi.fn().mockResolvedValue("這不是 JSON 喔");
    const rounds = await generateRounds("出題", 3, {}, { generate });
    expect(rounds).toBeNull();
  });

  it("returns null when too few valid questions survive validation", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify([
        { question: "Q1", answers: ["A1"] },
        { question: "", answers: ["A2"] }, // 空題目，濾掉
        { question: "Q3", answers: [] }, // 沒答案，濾掉
      ]),
    );
    const rounds = await generateRounds("出題", 5, {}, { generate });
    expect(rounds).toBeNull(); // 只剩 1 題，低於 min(3, count)
  });

  it("returns null when the LLM call throws", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("timeout"));
    const rounds = await generateRounds("出題", 3, {}, { generate });
    expect(rounds).toBeNull();
  });

  it("includes category hint and avoid-list in the prompt sent to the model", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify([
        { question: "Q1", answers: ["A1"] },
        { question: "Q2", answers: ["A2"] },
        { question: "Q3", answers: ["A3"] },
      ]),
    );
    const client: LLMClient = { generate };
    await generateRounds(
      "出題",
      3,
      { categoryHint: "運動、美食", avoidQuestions: ["台灣最高的山是？"] },
      client,
    );
    const call = generate.mock.calls[0][0];
    expect(call.userPrompt).toContain("運動、美食");
    expect(call.userPrompt).toContain("台灣最高的山是？");
    expect(call.temperature).toBeGreaterThan(1); // 出題要比一般文案更隨機
  });
});
