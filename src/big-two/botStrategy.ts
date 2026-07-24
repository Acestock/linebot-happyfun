/**
 * 機器人出牌策略 — 純函式，故意做成「簡單/貪婪」而不是會算牌、會保留大牌的高手：
 * 領牌永遠出最小單張，跟牌永遠找剛好打得過的最小組合，找不到就 Pass。這款機器人的
 * 定位是「湊人數陪玩」，不是挑戰性的對手。
 */
import {
  type CardCode,
  type Combo,
  RANK_ORDER,
  comboBeats,
  groupByRank,
  groupBySuit,
  identifyCombo,
  sortHand,
  THREE_OF_CLUBS,
} from "./logic";

export type BotMove = { action: "play"; cards: CardCode[] } | { action: "pass" };

function bestBeatingCandidate(candidates: CardCode[][], current: Combo): CardCode[] | null {
  let best: { cards: CardCode[]; combo: Combo } | null = null;
  for (const cards of candidates) {
    const combo = identifyCombo(cards);
    if (!combo || !comboBeats(combo, current)) continue;
    if (!best || combo.compareKey < best.combo.compareKey) {
      best = { cards, combo };
    }
  }
  return best?.cards ?? null;
}

function singleCandidates(hand: CardCode[]): CardCode[][] {
  return sortHand(hand).map((c) => [c]);
}

function pairCandidates(hand: CardCode[]): CardCode[][] {
  const candidates: CardCode[][] = [];
  for (const group of groupByRank(hand).values()) {
    if (group.length >= 2) candidates.push(group.slice(0, 2));
  }
  return candidates;
}

function tripleCandidates(hand: CardCode[]): CardCode[][] {
  const candidates: CardCode[][] = [];
  for (const group of groupByRank(hand).values()) {
    if (group.length >= 3) candidates.push(group.slice(0, 3));
  }
  return candidates;
}

/** 五張牌型的候選只做「找得到就好」的簡單搜尋，不追求找出理論上最小的那一組。 */
function fiveCardCandidates(hand: CardCode[]): CardCode[][] {
  const candidates: CardCode[][] = [];
  const byRank = groupByRank(hand);
  const bySuit = groupBySuit(hand);

  for (const [rank, group] of byRank) {
    if (group.length === 4) {
      const kicker = sortHand(hand.filter((c) => c[0] !== rank))[0];
      if (kicker) candidates.push([...group, kicker]);
    }
  }

  for (const [rank, tripleGroup] of byRank) {
    if (tripleGroup.length < 3) continue;
    for (const [otherRank, pairGroup] of byRank) {
      if (otherRank === rank || pairGroup.length < 2) continue;
      candidates.push([...tripleGroup.slice(0, 3), ...pairGroup.slice(0, 2)]);
    }
  }

  for (const group of bySuit.values()) {
    if (group.length < 5) continue;
    const sorted = sortHand(group);
    candidates.push(sorted.slice(0, 5));
    candidates.push(sorted.slice(-5));
  }

  for (let start = 0; start <= RANK_ORDER.length - 1 - 5; start++) {
    const ranks = RANK_ORDER.slice(start, start + 5);
    if (ranks.includes("2")) continue;
    const picked: CardCode[] = [];
    for (const rank of ranks) {
      const group = byRank.get(rank);
      if (!group || group.length === 0) break;
      picked.push(sortHand(group)[0]);
    }
    if (picked.length === 5) candidates.push(picked);
  }

  return candidates;
}

/**
 * currentTrick 為 null 代表輪到自己領牌；isFirstTrickOfGame 代表這是整場遊戲的第一手，
 * 領牌時必須含方塊 3（用單張方塊 3 打最省事，一定合法）。
 */
export function chooseBotMove(hand: CardCode[], currentTrick: Combo | null, isFirstTrickOfGame: boolean): BotMove {
  if (!currentTrick) {
    if (isFirstTrickOfGame && hand.includes(THREE_OF_CLUBS)) {
      return { action: "play", cards: [THREE_OF_CLUBS] };
    }
    return { action: "play", cards: [sortHand(hand)[0]] };
  }

  const length = currentTrick.cards.length;
  const candidates =
    length === 1
      ? singleCandidates(hand)
      : length === 2
        ? pairCandidates(hand)
        : length === 3
          ? tripleCandidates(hand)
          : length === 5
            ? fiveCardCandidates(hand)
            : [];

  const beating = bestBeatingCandidate(candidates, currentTrick);
  return beating ? { action: "play", cards: beating } : { action: "pass" };
}
