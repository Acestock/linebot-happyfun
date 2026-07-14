import { describe, expect, it } from "vitest";
import {
  isHelpCommand,
  isStatusCommand,
  parseCheckin,
  parseFeedback,
  parseHostCommandFromCode,
  parseHostCommandFromText,
} from "../commands";

describe("parseHostCommandFromText", () => {
  it("recognizes every documented slash command", () => {
    expect(parseHostCommandFromText("/建立小聚")).toBe("create");
    expect(parseHostCommandFromText("/開始小聚")).toBe("start");
    expect(parseHostCommandFromText("/下一步")).toBe("next");
    expect(parseHostCommandFromText("/跳過")).toBe("skip");
    expect(parseHostCommandFromText("/換題目")).toBe("change_question");
    expect(parseHostCommandFromText("/暫停小聚")).toBe("pause");
    expect(parseHostCommandFromText("/繼續小聚")).toBe("resume");
    expect(parseHostCommandFromText("/結束小聚")).toBe("end");
    expect(parseHostCommandFromText("/取消小聚")).toBe("cancel");
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseHostCommandFromText("  /下一步  ")).toBe("next");
  });

  it("returns null for unrelated text", () => {
    expect(parseHostCommandFromText("下一步")).toBeNull();
    expect(parseHostCommandFromText("party")).toBeNull();
    expect(parseHostCommandFromText("")).toBeNull();
  });
});

describe("parseHostCommandFromCode", () => {
  it("maps postback short codes to the same command set", () => {
    expect(parseHostCommandFromCode("next")).toBe("next");
    expect(parseHostCommandFromCode("change")).toBe("change_question");
    expect(parseHostCommandFromCode("bogus")).toBeNull();
  });
});

describe("status/help commands", () => {
  it("matches exact status and help strings only", () => {
    expect(isStatusCommand("/小聚狀態")).toBe(true);
    expect(isStatusCommand("小聚狀態")).toBe(false);
    expect(isHelpCommand("/小聚說明")).toBe(true);
    expect(isHelpCommand("/建立小聚")).toBe(false);
  });
});

describe("parseCheckin", () => {
  it("recognizes /簽到 with trailing text", () => {
    expect(parseCheckin("/簽到 今天很期待")).toEqual({ text: "今天很期待" });
  });

  it("recognizes bare /簽到 with no text", () => {
    expect(parseCheckin("/簽到")).toEqual({ text: null });
  });

  it("recognizes the quick-reply phrase 我到了", () => {
    expect(parseCheckin("我到了")).toEqual({ text: null });
  });

  it("returns null for unrelated text", () => {
    expect(parseCheckin("今天很期待")).toBeNull();
    expect(parseCheckin("/建立小聚")).toBeNull();
  });
});

describe("parseFeedback", () => {
  it("recognizes the three feedback phrases", () => {
    expect(parseFeedback("很喜歡")).toBe("很喜歡");
    expect(parseFeedback("還不錯")).toBe("還不錯");
    expect(parseFeedback("可以更好")).toBe("可以更好");
  });

  it("returns null for anything else", () => {
    expect(parseFeedback("普通")).toBeNull();
  });
});
