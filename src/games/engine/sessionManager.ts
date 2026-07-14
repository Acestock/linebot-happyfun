import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { getRedis } from "../../redis/client";
import { loadEnv } from "../../config/env";
import { logger } from "../../utils/logger";
import { getGame } from "./registry";
import type { GameState } from "./types";

interface ActiveGame {
  sessionId: string;
  gameType: string;
  state: GameState;
}

const activeKey = (groupId: string) => `game:active:${groupId}`;

function ttlSeconds(): number {
  return loadEnv().GAME_TIMEOUT_MINUTES * 60;
}

async function getActive(groupId: string): Promise<ActiveGame | null> {
  const raw = await getRedis().get(activeKey(groupId));
  if (!raw) return null;
  return JSON.parse(raw) as ActiveGame;
}

async function saveActive(groupId: string, game: ActiveGame): Promise<void> {
  await getRedis().set(activeKey(groupId), JSON.stringify(game), "EX", ttlSeconds());
}

async function clearActive(groupId: string): Promise<void> {
  await getRedis().del(activeKey(groupId));
}

/** 開新局。回傳要回覆的文字。 */
export async function startGame(
  groupId: string,
  gameType: string,
  startedByMemberId: string | null,
): Promise<string> {
  const game = getGame(gameType);
  if (!game) return "找不到這個遊戲耶，輸入 party 看看目前有哪些遊戲！";

  const existing = await getActive(groupId);
  if (existing) {
    const existingGame = getGame(existing.gameType);
    return existingGame
      ? existingGame.inProgressText(existing.state)
      : "已經有一局遊戲在進行中囉！";
  }

  const { state, openingText, config } = game.createInitialState();
  const session = await prisma.gameSession.create({
    data: {
      groupId,
      gameType,
      status: "active",
      config: config as Prisma.InputJsonValue,
      startedByMemberId,
    },
  });

  await saveActive(groupId, { sessionId: session.id, gameType, state });
  return openingText;
}

/**
 * 處理群組訊息：若有進行中的遊戲且訊息是合法操作，回傳回覆文字；否則回 null。
 */
export async function handleGameMessage(
  groupId: string,
  memberId: string,
  text: string,
): Promise<string | null> {
  const active = await getActive(groupId);
  if (!active) return null;

  const game = getGame(active.gameType);
  if (!game) {
    await clearActive(groupId);
    return null;
  }

  const move = game.parseMove(text);
  if (!move) return null;

  const result = game.applyMove(active.state, move, { memberId });

  if (result.recordMove) {
    const nextState = result.nextState as { attempts?: number };
    prisma.gameMove
      .create({
        data: {
          sessionId: active.sessionId,
          memberId,
          moveIndex: nextState.attempts ?? 0,
          payload: (result.movePayload ?? {}) as Prisma.InputJsonValue,
          result: (result.moveOutcome ?? {}) as Prisma.InputJsonValue,
        },
      })
      .catch((err) => logger.error({ err }, "failed to record game move"));
  }

  if (result.finished) {
    await clearActive(groupId);
    await finishSession(active.sessionId, result.nextState, result.winnerMemberId ?? null);
  } else {
    await saveActive(groupId, { ...active, state: result.nextState });
  }

  return result.replyText;
}

/** 取消目前的遊戲。回傳要回覆的文字。 */
export async function cancelGame(groupId: string): Promise<string> {
  const active = await getActive(groupId);
  if (!active) return "現在沒有進行中的遊戲喔，輸入 party 開一局吧！";

  const game = getGame(active.gameType);
  await clearActive(groupId);
  await prisma.gameSession
    .update({
      where: { id: active.sessionId },
      data: { status: "cancelled", endedAt: new Date() },
    })
    .catch((err) => logger.error({ err }, "failed to mark session cancelled"));

  return game ? game.cancelText(active.state) : "本局已結束！";
}

async function finishSession(
  sessionId: string,
  finalState: GameState,
  winnerMemberId: string | null,
): Promise<void> {
  try {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: "finished", endedAt: new Date(), winnerMemberId },
    });

    const guessesByMember = (finalState.guessesByMember ?? {}) as Record<string, number>;
    for (const [memberId, guessesCount] of Object.entries(guessesByMember)) {
      await prisma.gameParticipant.upsert({
        where: { sessionId_memberId: { sessionId, memberId } },
        create: {
          sessionId,
          memberId,
          guessesCount,
          rank: memberId === winnerMemberId ? 1 : null,
        },
        update: {
          guessesCount,
          rank: memberId === winnerMemberId ? 1 : null,
        },
      });
    }
  } catch (err) {
    logger.error({ err, sessionId }, "failed to finalize game session");
  }
}
