import { describe, expect, it } from "vitest";
import {
  applyPass,
  applyPlay,
  buildDeck,
  combosComparable,
  comboBeats,
  createShuffledDeck,
  dealHands,
  identifyCombo,
  nextActiveSeat,
  THREE_OF_CLUBS,
  type Seat,
  type TableState,
  validatePlay,
} from "../logic";

describe("buildDeck / createShuffledDeck", () => {
  it("produces 52 unique cards", () => {
    const deck = buildDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck).size).toBe(52);
  });

  it("shuffles without dropping or duplicating cards", () => {
    const shuffled = createShuffledDeck();
    expect(shuffled.length).toBe(52);
    expect(new Set(shuffled)).toEqual(new Set(buildDeck()));
  });
});

describe("dealHands", () => {
  it("splits the deck into four 13-card sorted hands with no overlap", () => {
    const deck = createShuffledDeck();
    const hands = dealHands(deck);
    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand.length).toBe(13);
    }
    const union = new Set(hands.flat());
    expect(union.size).toBe(52);
  });
});

describe("identifyCombo", () => {
  it("identifies a single card", () => {
    expect(identifyCombo(["5D"])?.shape).toBe("single");
  });

  it("identifies a pair (same rank)", () => {
    expect(identifyCombo(["5D", "5C"])?.shape).toBe("pair");
  });

  it("rejects a 'pair' of different ranks", () => {
    expect(identifyCombo(["5D", "6C"])).toBeNull();
  });

  it("identifies a triple", () => {
    expect(identifyCombo(["5D", "5C", "5H"])?.shape).toBe("triple");
  });

  it("rejects duplicate cards", () => {
    expect(identifyCombo(["5D", "5D"])).toBeNull();
  });

  it("identifies a straight (3-4-5-6-7)", () => {
    expect(identifyCombo(["3D", "4C", "5H", "6S", "7D"])?.shape).toBe("straight");
  });

  it("rejects a straight that includes rank 2", () => {
    expect(identifyCombo(["JD", "QC", "KH", "AS", "2D"])).toBeNull();
  });

  it("identifies a flush (same suit, not consecutive)", () => {
    expect(identifyCombo(["3D", "5D", "7D", "9D", "KD"])?.shape).toBe("flush");
  });

  it("identifies a full house (3+2)", () => {
    expect(identifyCombo(["5D", "5C", "5H", "9D", "9C"])?.shape).toBe("fullhouse");
  });

  it("identifies four of a kind + kicker as quad", () => {
    expect(identifyCombo(["5D", "5C", "5H", "5S", "9C"])?.shape).toBe("quad");
  });

  it("identifies a straight flush", () => {
    expect(identifyCombo(["3D", "4D", "5D", "6D", "7D"])?.shape).toBe("straightflush");
  });

  it("rejects five cards that don't form any recognized shape", () => {
    expect(identifyCombo(["3D", "4C", "5H", "9S", "KD"])).toBeNull();
  });

  it("rejects four cards (no valid 4-card shape)", () => {
    expect(identifyCombo(["3D", "4C", "5H", "6S"])).toBeNull();
  });
});

describe("comboBeats / combosComparable", () => {
  it("requires matching length for singles/pairs/triples", () => {
    const single = identifyCombo(["5D"])!;
    const pair = identifyCombo(["6D", "6C"])!;
    expect(combosComparable(single, pair)).toBe(false);
  });

  it("higher single rank beats lower rank", () => {
    const low = identifyCombo(["5D"])!;
    const high = identifyCombo(["6D"])!;
    expect(comboBeats(high, low)).toBe(true);
    expect(comboBeats(low, high)).toBe(false);
  });

  it("same rank single: suit order is 黑桃(S) > 紅心(H) > 方塊(D) > 梅花(C)", () => {
    const club = identifyCombo(["9C"])!;
    const diamond = identifyCombo(["9D"])!;
    const heart = identifyCombo(["9H"])!;
    const spade = identifyCombo(["9S"])!;
    expect(comboBeats(diamond, club)).toBe(true);
    expect(comboBeats(heart, diamond)).toBe(true);
    expect(comboBeats(spade, heart)).toBe(true);
  });

  it("any 5-card combo can be compared against any other 5-card combo", () => {
    const straight = identifyCombo(["3D", "4C", "5H", "6S", "7D"])!;
    const flush = identifyCombo(["3D", "5D", "7D", "9D", "KD"])!;
    expect(combosComparable(straight, flush)).toBe(true);
    expect(comboBeats(flush, straight)).toBe(true);
  });

  it("full house beats flush regardless of individual card ranks", () => {
    const flush = identifyCombo(["AD", "TD", "8D", "6D", "4D"])!; // 高牌是 A，牌力仍低於葫蘆
    const fullhouse = identifyCombo(["3D", "3C", "3H", "4D", "4C"])!;
    expect(comboBeats(fullhouse, flush)).toBe(true);
  });

  it("quad beats full house, straight flush beats quad", () => {
    const fullhouse = identifyCombo(["KD", "KC", "KH", "QD", "QC"])!;
    const quad = identifyCombo(["3D", "3C", "3H", "3S", "4D"])!;
    const straightflush = identifyCombo(["4D", "5D", "6D", "7D", "8D"])!;
    expect(comboBeats(quad, fullhouse)).toBe(true);
    expect(comboBeats(straightflush, quad)).toBe(true);
  });
});

describe("validatePlay", () => {
  const hand = ["3D", "3C", "4D", "5D", "9H"];

  it("rejects cards not in hand", () => {
    expect(validatePlay(hand, ["2S"], null, false).ok).toBe(false);
  });

  it("rejects an invalid combo shape", () => {
    expect(validatePlay(hand, ["3D", "9H"], null, false).ok).toBe(false);
  });

  it("requires the three of clubs on the first play of the game", () => {
    const result = validatePlay(hand, ["4D", "5D"], null, true);
    expect(result.ok).toBe(false);
  });

  it("accepts the three of clubs as a valid opening play", () => {
    const result = validatePlay(hand, [THREE_OF_CLUBS], null, true);
    expect(result.ok).toBe(true);
  });

  it("rejects a play that doesn't beat the current trick", () => {
    const currentTrick = identifyCombo(["9S"])!;
    expect(validatePlay(hand, ["4D"], currentTrick, false).ok).toBe(false);
  });

  it("accepts a play that beats the current trick", () => {
    const currentTrick = identifyCombo(["4D"])!;
    const result = validatePlay(hand, ["5D"], currentTrick, false);
    expect(result.ok).toBe(true);
    expect(result.combo?.shape).toBe("single");
  });
});

function makeTable(hands: string[][]): TableState {
  const seats: Seat[] = hands.map((hand, seatIndex) => ({ seatIndex, hand, finishRank: null }));
  return { seats, currentTurnSeat: 0, currentTrick: null, passedSeats: [], isFirstTrickOfGame: true };
}

describe("applyPlay / applyPass / nextActiveSeat", () => {
  it("advances turn to the next seat and clears isFirstTrickOfGame after a play", () => {
    const table = makeTable([["3C", "4D"], ["5D", "6D"], ["7D", "8D"], ["9D", "TD"]]);
    const outcome = applyPlay(table, 0, ["3C"]);
    expect(outcome.type).toBe("played");
    if (outcome.type !== "played") throw new Error("expected played");
    expect(outcome.table.currentTurnSeat).toBe(1);
    expect(outcome.table.isFirstTrickOfGame).toBe(false);
    expect(outcome.table.currentTrick).toEqual({ plays: [{ seatIndex: 0, cards: ["3C"] }] });
  });

  it("rejects a play when it isn't that seat's turn", () => {
    const table = makeTable([["3D"], ["5D"], ["7D"], ["9D"]]);
    const outcome = applyPlay(table, 1, ["5D"]);
    expect(outcome.type).toBe("invalid");
  });

  it("clears the trick after all other active players pass in turn", () => {
    let table = makeTable([["3C", "4D"], ["5D"], ["7D"], ["9D"]]);
    const played = applyPlay(table, 0, ["3C"]);
    if (played.type !== "played") throw new Error("expected played");
    table = played.table;

    const pass1 = applyPass(table, 1);
    if (pass1.type !== "played") throw new Error("expected played");
    expect(pass1.table.currentTrick).not.toBeNull();
    table = pass1.table;

    const pass2 = applyPass(table, 2);
    if (pass2.type !== "played") throw new Error("expected played");
    expect(pass2.table.currentTrick).not.toBeNull();
    table = pass2.table;

    const pass3 = applyPass(table, 3);
    if (pass3.type !== "played") throw new Error("expected played");
    expect(pass3.table.currentTrick).toBeNull();
    expect(pass3.table.passedSeats).toEqual([]);
    expect(pass3.table.currentTurnSeat).toBe(0); // 繞回原出牌者
  });

  it("never gives another turn to a seat that already passed this trick, even after someone else plays", () => {
    // 大老二規則：pass 一次就退出這一輪直到清桌為止，不是「輪到你才臨時決定」。
    // 0 領牌 → 1 pass → 2 pass → 3 出牌蓋過 → 0 再出牌蓋過 → 接下來照座位順序本來會輪到 1，
    // 但 1 已經 pass 過了，應該直接跳過 1（跟 2），輪到 3，而不是讓 1 有機會回來再出牌。
    let table = makeTable([["3C", "AS", "4H"], ["4D"], ["5S"], ["TC", "KS"]]);

    const lead = applyPlay(table, 0, ["3C"]);
    if (lead.type !== "played") throw new Error("expected played");
    table = lead.table;

    const pass1 = applyPass(table, 1);
    if (pass1.type !== "played") throw new Error("expected played");
    table = pass1.table;

    const pass2 = applyPass(table, 2);
    if (pass2.type !== "played") throw new Error("expected played");
    table = pass2.table;

    const beat1 = applyPlay(table, 3, ["TC"]);
    if (beat1.type !== "played") throw new Error("expected played");
    expect(beat1.table.currentTurnSeat).toBe(0);
    table = beat1.table;

    const beat2 = applyPlay(table, 0, ["AS"]);
    if (beat2.type !== "played") throw new Error("expected played");
    // 這裡是關鍵斷言：座位順序上一般會是 0 之後輪到 1，但 1 已經 pass 過這一輪了，
    // 必須跳過 1（跟同樣 pass 過的 2），直接輪到還沒 pass 過的 3。
    expect(beat2.table.currentTurnSeat).toBe(3);
    table = beat2.table;

    // 3 也 pass 掉之後，場上只剩 0（唯一沒 pass 過的人）——這一輪結束，換 0 自由開新的一輪，
    // 這時候 passedSeats 要整個重置，之前 pass 過的 1、2 在新的一輪裡要能重新出牌。
    const finalPass = applyPass(table, 3);
    if (finalPass.type !== "played") throw new Error("expected played");
    expect(finalPass.table.currentTrick).toBeNull();
    expect(finalPass.table.currentTurnSeat).toBe(0);
    expect(finalPass.table.passedSeats).toEqual([]);
  });

  it("rejects passing while leading (no current trick)", () => {
    const table = makeTable([["3D"], ["5D"], ["7D"], ["9D"]]);
    const outcome = applyPass(table, 0);
    expect(outcome.type).toBe("invalid");
  });

  it("keeps every play made in the current trick, not just the most recent one", () => {
    let table = makeTable([["3C", "4D"], ["8H", "6D"], ["TC", "7D"], ["KS", "9D"]]);

    const play0 = applyPlay(table, 0, ["3C"]);
    if (play0.type !== "played") throw new Error("expected played");
    table = play0.table;

    const play1 = applyPlay(table, 1, ["8H"]);
    if (play1.type !== "played") throw new Error("expected played");
    table = play1.table;

    const play2 = applyPlay(table, 2, ["TC"]);
    if (play2.type !== "played") throw new Error("expected played");
    table = play2.table;

    // 檯面上要看得到這一輪三個人依序出過的牌，不能只剩最後一手（電腦連續接力出牌時，
    // 玩家才看得到中間每一手，不會只看到最後一隻機器人出的牌）。
    expect(table.currentTrick).toEqual({
      plays: [
        { seatIndex: 0, cards: ["3C"] },
        { seatIndex: 1, cards: ["8H"] },
        { seatIndex: 2, cards: ["TC"] },
      ],
    });
  });

  it("skips finished seats when advancing turns", () => {
    const seats: Seat[] = [
      { seatIndex: 0, hand: ["3D"], finishRank: null },
      { seatIndex: 1, hand: [], finishRank: 1 },
      { seatIndex: 2, hand: ["5D"], finishRank: null },
      { seatIndex: 3, hand: ["7D"], finishRank: null },
    ];
    expect(nextActiveSeat(seats, 0)).toBe(2);
  });

  it("assigns finish rank when a seat empties its hand, and auto-assigns the last remaining seat", () => {
    const seats: Seat[] = [
      { seatIndex: 0, hand: ["3D"], finishRank: null },
      { seatIndex: 1, hand: [], finishRank: 1 },
      { seatIndex: 2, hand: [], finishRank: 2 },
      { seatIndex: 3, hand: ["9D"], finishRank: null },
    ];
    const table: TableState = { seats, currentTurnSeat: 0, currentTrick: null, passedSeats: [], isFirstTrickOfGame: false };
    const outcome = applyPlay(table, 0, ["3D"]);
    if (outcome.type !== "played") throw new Error("expected played");
    expect(outcome.finishedSeat).toBe(0);
    expect(outcome.gameOver).toBe(true);
    const seat0 = outcome.table.seats.find((s) => s.seatIndex === 0);
    const seat3 = outcome.table.seats.find((s) => s.seatIndex === 3);
    expect(seat0?.finishRank).toBe(3);
    expect(seat3?.finishRank).toBe(4);
  });
});
