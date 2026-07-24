/**
 * 大老二純邏輯（無 I/O）— 牌組、牌型判斷、出牌合法性、回合推進。
 * 跟 src/wordle/logic.ts 同樣的角色：manager.ts 負責 DB，這裡只做資料運算。
 *
 * 牌面用兩個字元的字串表示：第一碼是點數、第二碼是花色，例如 "3D"（方塊 3）、
 * "TC"（梅花 10，用 T 避免兩碼點數讓字串長度不一致）、"2S"（黑桃 2，牌面最大）。
 */

export type Suit = "D" | "C" | "H" | "S";
export type CardCode = string;

const SUIT_ORDER: Suit[] = ["D", "C", "H", "S"]; // 花色排序（小到大），只有單張比較時當作同點數的 tiebreak
export const RANK_ORDER = ["3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A", "2"]; // 點數排序（小到大）

export const THREE_OF_CLUBS: CardCode = "3C";

function rankIndex(code: CardCode): number {
  return RANK_ORDER.indexOf(code[0]);
}

function suitIndex(code: CardCode): number {
  return SUIT_ORDER.indexOf(code[1] as Suit);
}

function cardValue(code: CardCode): number {
  return rankIndex(code) * SUIT_ORDER.length + suitIndex(code);
}

export function sortHand(cards: CardCode[]): CardCode[] {
  return [...cards].sort((a, b) => cardValue(a) - cardValue(b));
}

export function buildDeck(): CardCode[] {
  const deck: CardCode[] = [];
  for (const rank of RANK_ORDER) {
    for (const suit of SUIT_ORDER) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createShuffledDeck(): CardCode[] {
  return shuffle(buildDeck());
}

/** 52 張牌均分給 4 個座位，各 13 張，回傳時已排序好方便顯示。 */
export function dealHands(deck: CardCode[]): [CardCode[], CardCode[], CardCode[], CardCode[]] {
  const hands: CardCode[][] = [[], [], [], []];
  deck.forEach((card, i) => hands[i % 4].push(card));
  return hands.map(sortHand) as [CardCode[], CardCode[], CardCode[], CardCode[]];
}

export function groupByRank(cards: CardCode[]): Map<string, CardCode[]> {
  const map = new Map<string, CardCode[]>();
  for (const c of cards) {
    map.set(c[0], [...(map.get(c[0]) ?? []), c]);
  }
  return map;
}

export function groupBySuit(cards: CardCode[]): Map<Suit, CardCode[]> {
  const map = new Map<Suit, CardCode[]>();
  for (const c of cards) {
    const suit = c[1] as Suit;
    map.set(suit, [...(map.get(suit) ?? []), c]);
  }
  return map;
}

export type ComboShape = "single" | "pair" | "triple" | "straight" | "flush" | "fullhouse" | "quad" | "straightflush";

export interface Combo {
  shape: ComboShape;
  cards: CardCode[];
  /** 只在「牌型相同（5 張牌型彼此都算相同）、長度相同」的組合之間才有比較意義。 */
  compareKey: number;
}

// 5 張牌型的牌型優先權：順子 < 同花 < 葫蘆 < 鐵支 < 同花順，比較時優先權不同直接分勝負。
const FIVE_CARD_SHAPE_PRIORITY: Record<string, number> = {
  straight: 0,
  flush: 1,
  fullhouse: 2,
  quad: 3,
  straightflush: 4,
};

function isFlush(cards: CardCode[]): boolean {
  return cards.every((c) => c[1] === cards[0][1]);
}

/** 大老二慣例：2 最大、不能參與順子，所以只檢查 3~A 這 12 個點數區間內的連續 5 張。 */
function isStraight(cards: CardCode[]): boolean {
  if (cards.some((c) => c[0] === "2")) return false;
  const indices = cards.map(rankIndex).sort((a, b) => a - b);
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) return false;
  }
  return true;
}

/** 判斷一組牌是不是合法牌型；不合法（含重複牌、湊不成任何牌型）回傳 null。 */
export function identifyCombo(cardsInput: CardCode[]): Combo | null {
  if (cardsInput.length === 0) return null;
  const cards = sortHand(cardsInput);
  if (new Set(cards).size !== cards.length) return null;

  if (cards.length === 1) {
    return { shape: "single", cards, compareKey: cardValue(cards[0]) };
  }

  if (cards.length === 2 || cards.length === 3) {
    const ranks = new Set(cards.map((c) => c[0]));
    if (ranks.size !== 1) return null;
    return { shape: cards.length === 2 ? "pair" : "triple", cards, compareKey: rankIndex(cards[0]) };
  }

  if (cards.length === 5) {
    const groups = [...groupByRank(cards).values()].sort((a, b) => b.length - a.length);
    const flush = isFlush(cards);
    const straight = isStraight(cards);
    const highCard = cards[cards.length - 1];

    if (straight && flush) {
      return { shape: "straightflush", cards, compareKey: FIVE_CARD_SHAPE_PRIORITY.straightflush * 1000 + cardValue(highCard) };
    }
    if (groups[0].length === 4) {
      return { shape: "quad", cards, compareKey: FIVE_CARD_SHAPE_PRIORITY.quad * 1000 + rankIndex(groups[0][0]) };
    }
    if (groups[0].length === 3 && groups[1]?.length === 2) {
      return { shape: "fullhouse", cards, compareKey: FIVE_CARD_SHAPE_PRIORITY.fullhouse * 1000 + rankIndex(groups[0][0]) };
    }
    if (flush) {
      return { shape: "flush", cards, compareKey: FIVE_CARD_SHAPE_PRIORITY.flush * 1000 + cardValue(highCard) };
    }
    if (straight) {
      return { shape: "straight", cards, compareKey: FIVE_CARD_SHAPE_PRIORITY.straight * 1000 + cardValue(highCard) };
    }
    return null;
  }

  return null;
}

/** 只有長度相同才能比；5 張牌型彼此都算「長度相同」，其餘長度還要牌型也一樣。 */
export function combosComparable(a: Combo, b: Combo): boolean {
  if (a.cards.length !== b.cards.length) return false;
  if (a.cards.length === 5) return true;
  return a.shape === b.shape;
}

export function comboBeats(candidate: Combo, current: Combo): boolean {
  return combosComparable(candidate, current) && candidate.compareKey > current.compareKey;
}

export interface PlayValidation {
  ok: boolean;
  combo?: Combo;
  reason?: string;
}

/**
 * 出牌合法性檢查的單一入口：牌要在手上、湊得成合法牌型、開局第一手要含方塊 3、
 * 有檯面牌的話要打得過。currentTrickCombo 為 null 代表「自己領牌」（檯面已清空）。
 */
export function validatePlay(
  hand: CardCode[],
  selectedCards: CardCode[],
  currentTrickCombo: Combo | null,
  isFirstTrickOfGame: boolean,
): PlayValidation {
  const handSet = new Set(hand);
  if (selectedCards.length === 0 || !selectedCards.every((c) => handSet.has(c))) {
    return { ok: false, reason: "selected cards are not in hand" };
  }

  const combo = identifyCombo(selectedCards);
  if (!combo) {
    return { ok: false, reason: "not a valid combo shape" };
  }

  if (isFirstTrickOfGame && !currentTrickCombo && !combo.cards.includes(THREE_OF_CLUBS)) {
    return { ok: false, reason: "first play of the game must include the three of clubs" };
  }

  if (currentTrickCombo && !comboBeats(combo, currentTrickCombo)) {
    return { ok: false, reason: "does not beat the current trick" };
  }

  return { ok: true, combo };
}

export interface Seat {
  seatIndex: number;
  hand: CardCode[];
  finishRank: number | null;
}

export interface TrickPlay {
  seatIndex: number;
  cards: CardCode[];
}

/**
 * 純邏輯運算用的最小牌桌狀態切片，跟 Prisma 的 BigTwoGame/BigTwoSeat 脫鉤——
 * manager.ts 負責在這個型別跟資料庫列之間轉換。
 *
 * currentTrick 記錄「這一輪從有人領牌到現在」所有人出過的牌（依出牌順序），不是只存
 * 最後一手——前端要把整輪出過的牌攤在桌上讓玩家看得到（例如連續兩隻機器人接力出牌時，
 * 兩手都要看得到，不能只看到最後一手），判定「打不打得過」時只需要看 plays 陣列最後
 * 一筆（目前檯面上最大的那手）。
 */
export interface TableState {
  seats: Seat[]; // 固定長度 4，依 seatIndex 排序
  currentTurnSeat: number;
  currentTrick: { plays: TrickPlay[] } | null;
  passCount: number;
  isFirstTrickOfGame: boolean;
}

export type PlayOutcome =
  | { type: "invalid"; reason: string }
  | { type: "played"; table: TableState; finishedSeat: number | null; gameOver: boolean };

/** 找下一個「還沒結束」的座位（略過已經定名次的人）；順時鐘座位順序 0→1→2→3→0。 */
export function nextActiveSeat(seats: Seat[], from: number): number {
  for (let step = 1; step <= seats.length; step++) {
    const idx = (from + step) % seats.length;
    if (seats[idx].finishRank === null) return idx;
  }
  return from;
}

export function applyPlay(table: TableState, seatIndex: number, cards: CardCode[]): PlayOutcome {
  if (table.currentTurnSeat !== seatIndex) {
    return { type: "invalid", reason: "not your turn" };
  }

  const seat = table.seats[seatIndex];
  const lastPlay = table.currentTrick ? table.currentTrick.plays[table.currentTrick.plays.length - 1] : null;
  const currentCombo = lastPlay ? identifyCombo(lastPlay.cards) : null;
  const validation = validatePlay(seat.hand, cards, currentCombo, table.isFirstTrickOfGame);
  if (!validation.ok) {
    return { type: "invalid", reason: validation.reason ?? "invalid play" };
  }

  const cardSet = new Set(cards);
  const remainingHand = seat.hand.filter((c) => !cardSet.has(c));
  const seats = table.seats.map((s) => (s.seatIndex === seatIndex ? { ...s, hand: remainingHand } : s));

  let finishedSeat: number | null = null;
  if (remainingHand.length === 0) {
    const rank = seats.filter((s) => s.finishRank !== null).length + 1;
    seats[seatIndex] = { ...seats[seatIndex], finishRank: rank };
    finishedSeat = seatIndex;
  }

  const remainingPlayers = seats.filter((s) => s.finishRank === null);
  const gameOver = remainingPlayers.length <= 1;
  if (gameOver && remainingPlayers.length === 1) {
    const lastSeat = remainingPlayers[0];
    seats[lastSeat.seatIndex] = { ...lastSeat, finishRank: 4 };
  }

  const plays = table.currentTrick ? [...table.currentTrick.plays, { seatIndex, cards }] : [{ seatIndex, cards }];

  return {
    type: "played",
    table: {
      seats,
      currentTurnSeat: gameOver ? seatIndex : nextActiveSeat(seats, seatIndex),
      currentTrick: { plays },
      passCount: 0,
      isFirstTrickOfGame: false,
    },
    finishedSeat,
    gameOver,
  };
}

export function applyPass(table: TableState, seatIndex: number): PlayOutcome {
  if (table.currentTurnSeat !== seatIndex) {
    return { type: "invalid", reason: "not your turn" };
  }
  if (!table.currentTrick) {
    return { type: "invalid", reason: "cannot pass while leading" };
  }

  const passCount = table.passCount + 1;
  const activePlayers = table.seats.filter((s) => s.finishRank === null).length;
  const trickCleared = passCount >= activePlayers - 1;

  return {
    type: "played",
    table: {
      ...table,
      currentTurnSeat: nextActiveSeat(table.seats, seatIndex),
      currentTrick: trickCleared ? null : table.currentTrick,
      passCount: trickCleared ? 0 : passCount,
      isFirstTrickOfGame: false,
    },
    finishedSeat: null,
    gameOver: false,
  };
}
