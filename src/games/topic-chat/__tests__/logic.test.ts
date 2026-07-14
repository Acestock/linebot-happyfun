import { describe, expect, it } from "vitest";
import {
  MAX_CHIMES_PER_SESSION,
  MAX_RECENT,
  createTopicState,
  isSummonSummary,
  recordMessage,
} from "../logic";

// rand() = 0 → 間隔固定為最小值 5，讓測試可預測
const fixedRand = () => 0;

describe("topic-chat logic", () => {
  it("summon keywords trigger summary, ordinary chat does not", () => {
    expect(isSummonSummary("總結")).toBe(true);
    expect(isSummonSummary(" 阿密總結 ")).toBe(true);
    expect(isSummonSummary("阿密 總結")).toBe(true);
    expect(isSummonSummary("我覺得要總結一下人生")).toBe(false);
  });

  it("stays silent until the chime threshold, then chimes and resets", () => {
    let state = createTopicState(fixedRand); // nextChimeAfter = 5
    for (let i = 1; i <= 4; i++) {
      const r = recordMessage(state, `m${i}`, `名字${i}`, `訊息${i}`, fixedRand);
      expect(r.shouldChime).toBe(false);
      state = r.state;
    }
    const fifth = recordMessage(state, "m5", "名字5", "訊息5", fixedRand);
    expect(fifth.shouldChime).toBe(true);
    expect(fifth.state.messagesSinceLastReply).toBe(0);
    expect(fifth.state.chimesUsed).toBe(1);
  });

  it("stops chiming after the per-session cap", () => {
    let state = createTopicState(fixedRand);
    let chimes = 0;
    for (let i = 0; i < 200; i++) {
      const r = recordMessage(state, "m1", "小明", `msg${i}`, fixedRand);
      if (r.shouldChime) chimes++;
      state = r.state;
    }
    expect(chimes).toBe(MAX_CHIMES_PER_SESSION);
    expect(state.chimesUsed).toBe(MAX_CHIMES_PER_SESSION);
  });

  it("keeps only the most recent messages for LLM context", () => {
    let state = createTopicState(fixedRand);
    for (let i = 1; i <= 20; i++) {
      state = recordMessage(state, "m1", "小明", `第${i}句`, fixedRand).state;
    }
    expect(state.recentMessages).toHaveLength(MAX_RECENT);
    expect(state.recentMessages[MAX_RECENT - 1]).toBe("小明：第20句");
  });

  it("counts per-member messages for participation stats", () => {
    let state = createTopicState(fixedRand);
    state = recordMessage(state, "a", "A", "hi", fixedRand).state;
    state = recordMessage(state, "b", "B", "yo", fixedRand).state;
    state = recordMessage(state, "a", "A", "again", fixedRand).state;
    expect(state.guessesByMember).toEqual({ a: 2, b: 1 });
  });

  it("truncates very long messages in the context buffer", () => {
    const state = recordMessage(createTopicState(fixedRand), "a", "A", "x".repeat(500), fixedRand)
      .state;
    expect(state.recentMessages[0].length).toBeLessThanOrEqual(100 + "A：".length);
  });
});
