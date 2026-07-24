import { Prisma, type BigTwoPhase } from "@prisma/client";
import { prisma } from "../db/prisma";
import { chooseBotMove } from "./botStrategy";
import {
  applyPass,
  applyPlay,
  createShuffledDeck,
  dealHands,
  identifyCombo,
  THREE_OF_CLUBS,
  type CardCode,
  type Seat as LogicSeat,
  type TableState,
  type TrickPlay,
} from "./logic";

/**
 * 大老二的 DB orchestration 層，跟 src/wordle/manager.ts 同樣的角色 —
 * 純規則在 logic.ts／botStrategy.ts，這裡只負責撈資料、組資料、寫資料。
 * 不直接單元測試，用真的本機 Postgres 跑 smoke script 驗證。
 *
 * 短輪詢架構（LIFF 頁面固定間隔打 REST API），沒有 WebSocket，所以「機器人即時出手」
 * 靠 advanceBotTurns：只要輪到的座位是機器人，就立刻算出動作、套用、檢查下一位，
 * 直到輪到真人或遊戲結束——跟 Wordle 的「懶惰結算」是同一種精神，這裡連機器人回合都
 * 用「懶惰推進」處理，不需要額外的排程/計時器。真人超時沒出手時，用同一顆機器人策略
 * 幫他頂那一手，避免遊戲卡死。
 */

export interface MemberIdentity {
  id: string;
  displayName: string | null;
}

const TOTAL_SEATS = 4;
const TURN_TIME_LIMIT_SECONDS = 45;
const BOT_NAMES = ["電腦小明", "電腦小華", "電腦阿凱"];
const POINTS_BY_RANK: Record<number, number> = { 1: 3, 2: 2, 3: 1, 4: 0 };

/** 台灣（UTC+8）當天日期字串，例如 "2026-07-16"；固定位移就夠，不需要日期函式庫 */
export function taipeiDateString(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

const GAME_INCLUDE = { seats: { include: { member: true } } } satisfies Prisma.BigTwoGameInclude;
type GameWithSeats = Prisma.BigTwoGameGetPayload<{ include: typeof GAME_INCLUDE }>;

async function findActiveGame(groupId: string): Promise<GameWithSeats | null> {
  return prisma.bigTwoGame.findFirst({
    where: { groupId, phase: { in: ["LOBBY", "PLAYING"] } },
    orderBy: { createdAt: "desc" },
    include: GAME_INCLUDE,
  });
}

async function findLatestGame(groupId: string): Promise<GameWithSeats | null> {
  return prisma.bigTwoGame.findFirst({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    include: GAME_INCLUDE,
  });
}

export interface SeatView {
  seatIndex: number;
  isBot: boolean;
  /** null 代表這個座位還空著，等真人加入 */
  displayName: string | null;
  isSelf: boolean;
  handCount: number;
  /** 只有 isSelf 才有值，其他人的手牌一律不外流 */
  hand: CardCode[] | null;
  finishRank: number | null;
}

export interface GameView {
  phase: BigTwoPhase;
  hostMemberId: string;
  isHost: boolean;
  botCount: number;
  currentTurnSeat: number | null;
  currentTrick: { plays: TrickPlay[] } | null;
  turnDeadlineAt: string | null;
  seats: SeatView[];
  mySeatIndex: number | null;
}

export interface StateView {
  /** null 代表這個群組還沒有任何一團（含歷史紀錄）可以顯示 */
  game: GameView | null;
}

function toGameView(game: GameWithSeats, member: MemberIdentity): GameView {
  const seats = [...game.seats]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((s): SeatView => {
      const isSelf = s.memberId === member.id;
      const hand = Array.isArray(s.hand) ? (s.hand as CardCode[]) : [];
      return {
        seatIndex: s.seatIndex,
        isBot: s.isBot,
        displayName: s.isBot ? s.botName : s.memberId ? (s.member?.displayName ?? "神秘玩家") : null,
        isSelf,
        handCount: hand.length,
        hand: isSelf ? hand : null,
        finishRank: s.finishRank,
      };
    });

  return {
    phase: game.phase,
    hostMemberId: game.hostMemberId,
    isHost: game.hostMemberId === member.id,
    botCount: game.botCount,
    currentTurnSeat: game.currentTurnSeat,
    currentTrick: (game.currentTrick as { plays: TrickPlay[] } | null) ?? null,
    turnDeadlineAt: game.turnDeadlineAt ? game.turnDeadlineAt.toISOString() : null,
    seats,
    mySeatIndex: seats.find((s) => s.isSelf)?.seatIndex ?? null,
  };
}

function toTableState(game: GameWithSeats): TableState {
  const seats: LogicSeat[] = [...game.seats]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((s) => ({
      seatIndex: s.seatIndex,
      hand: Array.isArray(s.hand) ? (s.hand as CardCode[]) : [],
      finishRank: s.finishRank,
    }));
  const totalCardsInHands = seats.reduce((n, s) => n + s.hand.length, 0);

  return {
    seats,
    currentTurnSeat: game.currentTurnSeat ?? 0,
    currentTrick: (game.currentTrick as { plays: TrickPlay[] } | null) ?? null,
    passCount: game.passCount,
    // 52 張都還在手上代表這輪剛發完牌、整場遊戲一手都還沒出過，用來判斷梅花 3 規則。
    isFirstTrickOfGame: totalCardsInHands === 52,
  };
}

async function recordDailyStats(game: GameWithSeats, table: TableState): Promise<void> {
  const date = taipeiDateString();
  const humanFinishers = table.seats
    .map((seatState) => {
      const seatRow = game.seats.find((s) => s.seatIndex === seatState.seatIndex)!;
      if (seatRow.isBot || !seatRow.memberId || seatState.finishRank === null) return null;
      return { memberId: seatRow.memberId, finishRank: seatState.finishRank };
    })
    .filter((x): x is { memberId: string; finishRank: number } => x !== null);

  if (humanFinishers.length === 0) return;

  const existingRows = await prisma.bigTwoDailyStats.findMany({
    where: { groupId: game.groupId, date, memberId: { in: humanFinishers.map((f) => f.memberId) } },
  });
  const existingByMember = new Map(existingRows.map((r) => [r.memberId, r]));

  await prisma.$transaction(
    humanFinishers.map(({ memberId, finishRank }) => {
      const points = POINTS_BY_RANK[finishRank] ?? 0;
      const existing = existingByMember.get(memberId);
      const bestRank = existing?.bestRank != null ? Math.min(existing.bestRank, finishRank) : finishRank;
      return prisma.bigTwoDailyStats.upsert({
        where: { groupId_memberId_date: { groupId: game.groupId, memberId, date } },
        create: { groupId: game.groupId, memberId, date, gamesPlayed: 1, wins: finishRank === 1 ? 1 : 0, points, bestRank },
        update: {
          gamesPlayed: { increment: 1 },
          wins: finishRank === 1 ? { increment: 1 } : undefined,
          points: { increment: points },
          bestRank,
        },
      });
    }),
  );
}

/** 把記憶體中算完的 table 寫回 DB；遊戲剛好結束的話一併寫排行榜彙總。 */
async function persistTable(game: GameWithSeats, table: TableState): Promise<GameWithSeats> {
  const gameOver = table.seats.every((s) => s.finishRank !== null);

  const seatUpdates = table.seats.map((seatState) => {
    const original = game.seats.find((s) => s.seatIndex === seatState.seatIndex)!;
    return prisma.bigTwoSeat.update({
      where: { id: original.id },
      data: { hand: seatState.hand, finishRank: seatState.finishRank },
    });
  });

  const gameUpdate = gameOver
    ? prisma.bigTwoGame.update({
        where: { id: game.id },
        data: {
          phase: "FINISHED",
          currentTurnSeat: null,
          currentTrick: Prisma.DbNull,
          passCount: 0,
          turnDeadlineAt: null,
          finishedAt: new Date(),
        },
      })
    : prisma.bigTwoGame.update({
        where: { id: game.id },
        data: {
          currentTurnSeat: table.currentTurnSeat,
          currentTrick: (table.currentTrick as unknown as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
          passCount: table.passCount,
          turnDeadlineAt: new Date(Date.now() + TURN_TIME_LIMIT_SECONDS * 1000),
        },
      });

  await prisma.$transaction([...seatUpdates, gameUpdate]);
  if (gameOver) {
    await recordDailyStats(game, table);
  }

  return prisma.bigTwoGame.findUniqueOrThrow({ where: { id: game.id }, include: GAME_INCLUDE });
}

/**
 * 懶惰推進：只要目前輪到的座位是機器人就立刻幫它出手（可能連續好幾隻機器人排在一起），
 * 如果輪到的是真人但已經超過 turnDeadlineAt 還沒出手，也用同一顆機器人策略幫他頂一手，
 * 避免遊戲卡死；一旦遇到「還沒超時的真人」就停手，把回合交還給他自己操作。
 */
async function advanceBotTurns(game: GameWithSeats): Promise<GameWithSeats> {
  if (game.phase !== "PLAYING" || game.currentTurnSeat === null) return game;

  const originalTurnSeat = game.currentTurnSeat;
  const originalDeadlineExpired = game.turnDeadlineAt !== null && game.turnDeadlineAt.getTime() < Date.now();

  let table = toTableState(game);
  let mutated = false;

  for (let guard = 0; guard < 20; guard++) {
    const seatIndex = table.currentTurnSeat;
    const seatRow = game.seats.find((s) => s.seatIndex === seatIndex)!;
    const isOverdueOriginalHuman = !seatRow.isBot && seatIndex === originalTurnSeat && originalDeadlineExpired;
    if (!seatRow.isBot && !isOverdueOriginalHuman) break;

    const seatState = table.seats.find((s) => s.seatIndex === seatIndex)!;
    const lastPlay = table.currentTrick ? table.currentTrick.plays[table.currentTrick.plays.length - 1] : null;
    const currentCombo = lastPlay ? identifyCombo(lastPlay.cards) : null;
    const move = chooseBotMove(seatState.hand, currentCombo, table.isFirstTrickOfGame);
    const outcome = move.action === "play" ? applyPlay(table, seatIndex, move.cards) : applyPass(table, seatIndex);
    if (outcome.type === "invalid") break; // 防禦性煞車，理論上機器人策略一定合法

    table = outcome.table;
    mutated = true;
    if (outcome.gameOver) break;
  }

  return mutated ? persistTable(game, table) : game;
}

export type CreateGameResult = { ok: true; state: StateView } | { ok: false; error: "game_in_progress" };

export async function createGame(groupId: string, host: MemberIdentity): Promise<CreateGameResult> {
  const active = await findActiveGame(groupId);
  if (active) return { ok: false, error: "game_in_progress" };

  const game = await prisma.bigTwoGame.create({
    data: {
      groupId,
      hostMemberId: host.id,
      seats: {
        create: [{ seatIndex: 0, memberId: host.id }, { seatIndex: 1 }, { seatIndex: 2 }, { seatIndex: 3 }],
      },
    },
    include: GAME_INCLUDE,
  });

  return { ok: true, state: { game: toGameView(game, host) } };
}

export type JoinGameResult =
  | { ok: true; state: StateView }
  | { ok: false; error: "no_lobby" | "already_seated" | "lobby_full" };

export async function joinGame(groupId: string, member: MemberIdentity): Promise<JoinGameResult> {
  const game = await findActiveGame(groupId);
  if (!game || game.phase !== "LOBBY") return { ok: false, error: "no_lobby" };
  if (game.seats.some((s) => s.memberId === member.id)) return { ok: false, error: "already_seated" };

  const openSeat = game.seats.find((s) => s.memberId === null && !s.isBot);
  if (!openSeat) return { ok: false, error: "lobby_full" };

  await prisma.bigTwoSeat.update({ where: { id: openSeat.id }, data: { memberId: member.id } });
  const updated = await findActiveGame(groupId);
  return { ok: true, state: { game: toGameView(updated!, member) } };
}

export type ConfigureResult = { ok: true; state: StateView } | { ok: false; error: "no_lobby" | "not_host" };

/** botCount 只是房主設定的「至少補幾隻」，實際補位的座位數在 startGame 才決定。 */
export async function setBotCount(groupId: string, member: MemberIdentity, botCount: number): Promise<ConfigureResult> {
  const game = await findActiveGame(groupId);
  if (!game || game.phase !== "LOBBY") return { ok: false, error: "no_lobby" };
  if (game.hostMemberId !== member.id) return { ok: false, error: "not_host" };

  const clamped = Math.max(0, Math.min(TOTAL_SEATS - 1, Math.round(botCount)));
  await prisma.bigTwoGame.update({ where: { id: game.id }, data: { botCount: clamped } });
  const updated = await findActiveGame(groupId);
  return { ok: true, state: { game: toGameView(updated!, member) } };
}

export type StartGameResult = { ok: true; state: StateView } | { ok: false; error: "no_lobby" | "not_host" };

/** 開始遊戲：不管 botCount 設定多少，一律把還空著的座位全部補成機器人，確保湊滿 4 人。 */
export async function startGame(groupId: string, member: MemberIdentity): Promise<StartGameResult> {
  const game = await findActiveGame(groupId);
  if (!game || game.phase !== "LOBBY") return { ok: false, error: "no_lobby" };
  if (game.hostMemberId !== member.id) return { ok: false, error: "not_host" };

  const hands = dealHands(createShuffledDeck());
  let botNameIndex = 0;

  const seatUpdates = game.seats.map((seat) => {
    const isBot = seat.memberId === null;
    return prisma.bigTwoSeat.update({
      where: { id: seat.id },
      data: {
        hand: hands[seat.seatIndex],
        isBot,
        botName: isBot ? BOT_NAMES[botNameIndex++ % BOT_NAMES.length] : null,
        finishRank: null,
      },
    });
  });

  const startingSeat = game.seats.find((seat) => hands[seat.seatIndex].includes(THREE_OF_CLUBS))!.seatIndex;

  await prisma.$transaction([
    ...seatUpdates,
    prisma.bigTwoGame.update({
      where: { id: game.id },
      data: {
        phase: "PLAYING",
        currentTurnSeat: startingSeat,
        passCount: 0,
        turnDeadlineAt: new Date(Date.now() + TURN_TIME_LIMIT_SECONDS * 1000),
      },
    }),
  ]);

  const updated = await findActiveGame(groupId);
  const settled = await advanceBotTurns(updated!);
  return { ok: true, state: { game: toGameView(settled, member) } };
}

export type PlayResult =
  | { ok: true; state: StateView }
  | { ok: false; error: "no_active_game" | "not_your_turn" | "invalid_play" };

export async function playCards(groupId: string, member: MemberIdentity, cards: CardCode[]): Promise<PlayResult> {
  let game = await findActiveGame(groupId);
  if (!game || game.phase !== "PLAYING") return { ok: false, error: "no_active_game" };

  game = await advanceBotTurns(game);
  if (game.phase !== "PLAYING") return { ok: false, error: "no_active_game" };

  const mySeat = game.seats.find((s) => s.memberId === member.id);
  if (!mySeat || game.currentTurnSeat !== mySeat.seatIndex) {
    return { ok: false, error: "not_your_turn" };
  }

  const outcome = applyPlay(toTableState(game), mySeat.seatIndex, cards);
  if (outcome.type === "invalid") return { ok: false, error: "invalid_play" };

  let updatedGame = await persistTable(game, outcome.table);
  updatedGame = await advanceBotTurns(updatedGame);

  return { ok: true, state: { game: toGameView(updatedGame, member) } };
}

export async function passTurn(groupId: string, member: MemberIdentity): Promise<PlayResult> {
  let game = await findActiveGame(groupId);
  if (!game || game.phase !== "PLAYING") return { ok: false, error: "no_active_game" };

  game = await advanceBotTurns(game);
  if (game.phase !== "PLAYING") return { ok: false, error: "no_active_game" };

  const mySeat = game.seats.find((s) => s.memberId === member.id);
  if (!mySeat || game.currentTurnSeat !== mySeat.seatIndex) {
    return { ok: false, error: "not_your_turn" };
  }

  const outcome = applyPass(toTableState(game), mySeat.seatIndex);
  if (outcome.type === "invalid") return { ok: false, error: "invalid_play" };

  let updatedGame = await persistTable(game, outcome.table);
  updatedGame = await advanceBotTurns(updatedGame);

  return { ok: true, state: { game: toGameView(updatedGame, member) } };
}

/** LIFF 頁面輪詢用：找目前（或最近一次結束）的牌局，PLAYING 時順便懶惰推進機器人／超時回合。 */
export async function getStateView(groupId: string, member: MemberIdentity): Promise<StateView> {
  let game = await findLatestGame(groupId);
  if (!game) return { game: null };
  if (game.phase === "PLAYING") {
    game = await advanceBotTurns(game);
  }
  return { game: toGameView(game, member) };
}

export interface LeaderboardEntry {
  memberId: string;
  displayName: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  bestRank: number | null;
}

export interface Leaderboard {
  date: string;
  entries: LeaderboardEntry[];
}

/** 群組內今天的排行榜：依當天累積積分排序（1st=3/2nd=2/3rd=1/4th=0），再依勝場、場次。 */
export async function getLeaderboard(groupId: string): Promise<Leaderboard> {
  const date = taipeiDateString();
  const stats = await prisma.bigTwoDailyStats.findMany({
    where: { groupId, date, gamesPlayed: { gt: 0 } },
    include: { member: true },
    orderBy: [{ points: "desc" }, { wins: "desc" }, { gamesPlayed: "desc" }],
  });

  return {
    date,
    entries: stats.map((s) => ({
      memberId: s.memberId,
      displayName: s.member.displayName ?? "神秘玩家",
      points: s.points,
      wins: s.wins,
      gamesPlayed: s.gamesPlayed,
      bestRank: s.bestRank,
    })),
  };
}

export interface AllTimeEntry {
  memberId: string;
  displayName: string;
  points: number;
  wins: number;
  date: string;
}

/** 史上最高分 TOP 3：不限日期，每人只計入自己單日積分最高的那一天。 */
export async function getAllTimeTopThree(groupId: string): Promise<AllTimeEntry[]> {
  const rows = await prisma.bigTwoDailyStats.findMany({
    where: { groupId, gamesPlayed: { gt: 0 } },
    include: { member: true },
    orderBy: [{ points: "desc" }, { wins: "desc" }],
  });

  const seen = new Set<string>();
  const top: AllTimeEntry[] = [];
  for (const row of rows) {
    if (seen.has(row.memberId)) continue;
    seen.add(row.memberId);
    top.push({ memberId: row.memberId, displayName: row.member.displayName ?? "神秘玩家", points: row.points, wins: row.wins, date: row.date });
    if (top.length === 3) break;
  }
  return top;
}
