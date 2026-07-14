import { describe, expect, it } from "vitest";
import {
  nextSetupStep,
  parseCustomMinutes,
  parseIcebreakerOption,
  parseInteractionOption,
  parseStyleOption,
  parseTimeOption,
} from "../setupWizard";

describe("parseTimeOption", () => {
  it("parses the three fixed options into minutes", () => {
    expect(parseTimeOption("30 分鐘")).toBe(30);
    expect(parseTimeOption("60 分鐘")).toBe(60);
    expect(parseTimeOption("90 分鐘")).toBe(90);
  });

  it("recognizes 自訂 as a request for a custom value", () => {
    expect(parseTimeOption("自訂")).toBe("custom");
  });

  it("rejects arbitrary minute values not in the fixed option list", () => {
    expect(parseTimeOption("45 分鐘")).toBeNull();
    expect(parseTimeOption("hello")).toBeNull();
  });
});

describe("parseCustomMinutes", () => {
  it("accepts a plain number within a sane range", () => {
    expect(parseCustomMinutes("45")).toBe(45);
    expect(parseCustomMinutes("120 分鐘")).toBe(120);
  });

  it("rejects out-of-range or non-numeric input", () => {
    expect(parseCustomMinutes("0")).toBeNull();
    expect(parseCustomMinutes("3")).toBeNull();
    expect(parseCustomMinutes("999")).toBeNull();
    expect(parseCustomMinutes("很久")).toBeNull();
  });
});

describe("parseStyleOption / parseIcebreakerOption / parseInteractionOption", () => {
  it("only accepts the documented option labels", () => {
    expect(parseStyleOption("輕鬆")).toBe("輕鬆");
    expect(parseStyleOption("兇狠")).toBeNull();

    expect(parseIcebreakerOption("興趣交流")).toBe("interest");
    expect(parseIcebreakerOption("主辦人自訂")).toBe("custom");
    expect(parseIcebreakerOption("隨便")).toBeNull();

    expect(parseInteractionOption("二選一")).toBe("twochoice");
    expect(parseInteractionOption("不安排互動環節")).toBe("none");
    expect(parseInteractionOption("桌遊")).toBeNull();
  });
});

describe("nextSetupStep", () => {
  it("walks the standard path when icebreaker isn't custom", () => {
    expect(nextSetupStep("name", {})).toBe("time");
    expect(nextSetupStep("time", {})).toBe("style");
    expect(nextSetupStep("style", {})).toBe("icebreaker");
    expect(nextSetupStep("icebreaker", { icebreakerCategory: "daily" })).toBe("interaction");
    expect(nextSetupStep("interaction", {})).toBeNull();
  });

  it("inserts a custom-icebreaker-text step when the host picks 主辦人自訂", () => {
    expect(nextSetupStep("icebreaker", { icebreakerCategory: "custom" })).toBe(
      "custom_icebreaker_text",
    );
    expect(nextSetupStep("custom_icebreaker_text", {})).toBe("interaction");
  });

  it("custom_time always continues to style", () => {
    expect(nextSetupStep("custom_time", {})).toBe("style");
  });
});
