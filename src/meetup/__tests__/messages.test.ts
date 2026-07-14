import { MeetupPhase } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildClosingSummary,
  buildCreationConfirmation,
  buildIcebreakerText,
  buildInteractionText,
  buildOpeningText,
  buildSetupQuestionText,
  buildStatusText,
} from "../messages";

describe("buildCreationConfirmation", () => {
  it("matches the required field layout", () => {
    const text = buildCreationConfirmation({
      name: "週末創作者交流",
      hostDisplayName: "Kevin",
      plannedMinutes: 60,
      hostStyle: "輕鬆",
      icebreakerCategory: "interest",
      interactionType: "twochoice",
    });
    expect(text).toContain("活動名稱：週末創作者交流");
    expect(text).toContain("主辦人：Kevin");
    expect(text).toContain("預計時間：60 分鐘");
    expect(text).toContain("主持風格：輕鬆");
    expect(text).toContain("破冰類型：興趣交流");
    expect(text).toContain("互動環節：二選一");
    expect(text).toContain("開始小聚");
  });
});

describe("buildOpeningText", () => {
  it("mentions the interaction phase when one is configured", () => {
    const text = buildOpeningText({ name: "測試小聚", plannedMinutes: 30, interactionType: "quickfire" });
    expect(text).toContain("測試小聚");
    expect(text).toContain("30 分鐘");
    expect(text).toContain("互動環節");
  });

  it("omits the interaction phase when interactionType is none", () => {
    const text = buildOpeningText({ name: "測試小聚", plannedMinutes: 30, interactionType: "none" });
    expect(text).not.toContain("互動環節");
  });
});

describe("buildStatusText", () => {
  it("includes all required fields and formats them per the spec example", () => {
    const text = buildStatusText({
      name: "週末創作者交流",
      hostDisplayName: "Kevin",
      phase: MeetupPhase.ICEBREAKER,
      elapsedMinutes: 18,
      plannedMinutes: 60,
      checkinCount: 9,
      currentIcebreaker: "最近最常投入時間的一個興趣是什麼？",
      interactionType: "twochoice",
    });
    expect(text).toContain("活動：週末創作者交流");
    expect(text).toContain("主辦人：Kevin");
    expect(text).toContain("目前階段：破冰問題");
    expect(text).toContain("已進行：18 分鐘");
    expect(text).toContain("預計時間：60 分鐘");
    expect(text).toContain("已簽到：9 人");
    expect(text).toContain("目前破冰題：最近最常投入時間的一個興趣是什麼？");
    expect(text).toContain("互動環節：二選一");
  });

  it("omits icebreaker/interaction lines when not yet set", () => {
    const text = buildStatusText({
      name: "測試",
      hostDisplayName: "小明",
      phase: MeetupPhase.OPENING,
      elapsedMinutes: 1,
      plannedMinutes: 30,
      checkinCount: 0,
      currentIcebreaker: null,
      interactionType: null,
    });
    expect(text).not.toContain("目前破冰題");
    expect(text).not.toContain("互動環節");
  });
});

describe("other templates", () => {
  it("buildSetupQuestionText covers every step without throwing", () => {
    for (const step of [
      "name",
      "time",
      "custom_time",
      "style",
      "icebreaker",
      "custom_icebreaker_text",
      "interaction",
    ] as const) {
      expect(buildSetupQuestionText(step).length).toBeGreaterThan(0);
    }
  });

  it("buildIcebreakerText / buildInteractionText embed the given question", () => {
    expect(buildIcebreakerText("問題A")).toContain("問題A");
    expect(buildInteractionText("問題B")).toContain("問題B");
  });

  it("buildClosingSummary embeds the checkin count", () => {
    expect(buildClosingSummary(12)).toContain("12 人完成簽到");
  });
});
