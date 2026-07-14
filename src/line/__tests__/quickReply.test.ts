import { describe, expect, it } from "vitest";
import type { messagingApi } from "@line/bot-sdk";
import { buildPartyQuickReply, withPartyQuickReply } from "../quickReply";

describe("buildPartyQuickReply", () => {
  it("has a party message action and a cancel-game postback action", () => {
    const qr = buildPartyQuickReply();
    expect(qr.items).toHaveLength(2);
    expect(qr.items?.[0].action).toMatchObject({ type: "message", text: "party" });
    expect(qr.items?.[1].action).toMatchObject({
      type: "postback",
      data: "action=cancel_game",
    });
  });
});

describe("withPartyQuickReply", () => {
  it("attaches quickReply only to the last message", () => {
    const messages: messagingApi.Message[] = [
      { type: "text", text: "第一則" },
      { type: "text", text: "第二則" },
    ];
    const result = withPartyQuickReply(messages);
    expect((result[0] as { quickReply?: unknown }).quickReply).toBeUndefined();
    expect((result[1] as { quickReply?: unknown }).quickReply).toBeDefined();
  });

  it("does not mutate the original message objects", () => {
    const original: messagingApi.Message = { type: "text", text: "hi" };
    const result = withPartyQuickReply([original]);
    expect((original as { quickReply?: unknown }).quickReply).toBeUndefined();
    expect(result[0]).not.toBe(original);
  });

  it("returns an empty array unchanged", () => {
    expect(withPartyQuickReply([])).toEqual([]);
  });
});
