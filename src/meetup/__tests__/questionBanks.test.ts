import { describe, expect, it } from "vitest";
import { pickIcebreaker, pickInteractionPrompt } from "../questionBanks";

describe("pickIcebreaker", () => {
  it("returns the custom text verbatim for the custom category", () => {
    expect(pickIcebreaker("custom", [], "我自己出的題目")).toBe("我自己出的題目");
  });

  it("returns null for custom category with no text set", () => {
    expect(pickIcebreaker("custom", [], null)).toBeNull();
  });

  it("avoids questions already used when fresh ones remain", () => {
    for (let i = 0; i < 30; i++) {
      const q = pickIcebreaker("daily", ["最近有沒有一件讓你覺得「還好我有去做」的事情？"]);
      expect(q).not.toBe("最近有沒有一件讓你覺得「還好我有去做」的事情？");
    }
  });

  it("falls back to allowing repeats once the whole category bank is used", () => {
    const q1 = pickIcebreaker("work", []);
    expect(q1).toBeTruthy();
    // 假裝整個分類都用過了
    const allWorkQuestions = Array.from({ length: 20 }, () => pickIcebreaker("work", [])!);
    const usedEverything = [...new Set(allWorkQuestions)];
    const q2 = pickIcebreaker("work", usedEverything);
    expect(q2).toBeTruthy(); // 還是有題目可以出，不會回 null 卡住流程
  });

  it("random category draws from the combined pool", () => {
    const q = pickIcebreaker("random", []);
    expect(q).toBeTruthy();
  });
});

describe("pickInteractionPrompt", () => {
  it("returns null for 'none'", () => {
    expect(pickInteractionPrompt("none", [])).toBeNull();
  });

  it("returns the fixed chain rule text", () => {
    const result = pickInteractionPrompt("chain", []);
    expect(result?.resolvedType).toBe("chain");
    expect(result?.prompt).toContain("接龍");
  });

  it("resolves quickfire/twochoice/topic to themselves", () => {
    expect(pickInteractionPrompt("quickfire", [])?.resolvedType).toBe("quickfire");
    expect(pickInteractionPrompt("twochoice", [])?.resolvedType).toBe("twochoice");
    expect(pickInteractionPrompt("topic", [])?.resolvedType).toBe("topic");
  });

  it("random resolves to one of quickfire/twochoice/topic", () => {
    const resolved = new Set<string>();
    for (let i = 0; i < 30; i++) {
      resolved.add(pickInteractionPrompt("random", [])!.resolvedType);
    }
    for (const type of resolved) {
      expect(["quickfire", "twochoice", "topic"]).toContain(type);
    }
  });

  it("avoids reusing a prompt already used in this session", () => {
    const first = pickInteractionPrompt("quickfire", [])!;
    for (let i = 0; i < 30; i++) {
      const next = pickInteractionPrompt("quickfire", [first.prompt]);
      expect(next?.prompt).not.toBe(first.prompt);
    }
  });
});
