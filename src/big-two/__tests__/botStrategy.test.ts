import { describe, expect, it } from "vitest";
import { chooseBotMove } from "../botStrategy";
import { comboBeats, identifyCombo, THREE_OF_CLUBS } from "../logic";

describe("chooseBotMove — leading", () => {
  it("leads with the three of clubs on the first play of the game", () => {
    const hand = ["3C", "5D", "9H", "KS"];
    const move = chooseBotMove(hand, null, true);
    expect(move).toEqual({ action: "play", cards: [THREE_OF_CLUBS] });
  });

  it("leads with the lowest single card otherwise", () => {
    const hand = ["9H", "3C", "KS", "5D"];
    const move = chooseBotMove(hand, null, false);
    expect(move).toEqual({ action: "play", cards: ["3C"] });
  });
});

describe("chooseBotMove — following a single", () => {
  it("plays the smallest single that beats the current trick", () => {
    const hand = ["4D", "9C", "TC", "KS"];
    const currentTrick = identifyCombo(["6D"])!;
    const move = chooseBotMove(hand, currentTrick, false);
    expect(move.action).toBe("play");
    if (move.action !== "play") throw new Error("expected play");
    const combo = identifyCombo(move.cards)!;
    expect(comboBeats(combo, currentTrick)).toBe(true);
    expect(move.cards).toEqual(["9C"]);
  });

  it("passes when nothing in hand can beat the current single", () => {
    const hand = ["3D", "4C", "5H"];
    const currentTrick = identifyCombo(["KS"])!;
    const move = chooseBotMove(hand, currentTrick, false);
    expect(move).toEqual({ action: "pass" });
  });
});

describe("chooseBotMove — following a pair", () => {
  it("finds a beating pair when one exists", () => {
    const hand = ["4D", "4C", "9H", "9S", "KD"];
    const currentTrick = identifyCombo(["5D", "5C"])!;
    const move = chooseBotMove(hand, currentTrick, false);
    expect(move.action).toBe("play");
    if (move.action !== "play") throw new Error("expected play");
    expect(move.cards.sort()).toEqual(["9H", "9S"].sort());
  });

  it("passes when no pair in hand beats the current pair", () => {
    const hand = ["4D", "4C", "9H", "KD"];
    const currentTrick = identifyCombo(["TD", "TC"])!;
    const move = chooseBotMove(hand, currentTrick, false);
    expect(move).toEqual({ action: "pass" });
  });
});

describe("chooseBotMove — following a five-card hand", () => {
  it("beats a straight with a flush when available", () => {
    const hand = ["2D", "4D", "6D", "8D", "TD", "3C", "5C"];
    const currentTrick = identifyCombo(["3H", "4S", "5D", "6C", "7H"])!;
    const move = chooseBotMove(hand, currentTrick, false);
    expect(move.action).toBe("play");
    if (move.action !== "play") throw new Error("expected play");
    const combo = identifyCombo(move.cards)!;
    expect(comboBeats(combo, currentTrick)).toBe(true);
  });

  it("passes when no five-card combo beats the current trick", () => {
    const hand = ["3D", "4C", "5H", "6S", "7D", "9C", "TH"];
    const currentTrick = identifyCombo(["4D", "4C", "4H", "4S", "9D"])!; // 鐵支，幾乎打不過
    const move = chooseBotMove(hand, currentTrick, false);
    expect(move).toEqual({ action: "pass" });
  });
});
