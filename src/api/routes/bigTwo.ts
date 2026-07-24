import { Router, type Request, type RequestHandler, type Response } from "express";
import { loadEnv } from "../../config/env";
import { verifyLineIdToken } from "../../line/idToken";
import { isValidLineGroupId, upsertGroupMemberByLineIds } from "../../db/groupRepository";
import { prisma } from "../../db/prisma";
import {
  createGame,
  getAllTimeTopThree,
  getLeaderboard,
  getStateView,
  joinGame,
  passTurn,
  playCards,
  setBotCount,
  startGame,
  VALID_SEAT_COUNTS,
  type SeatCount,
} from "../../big-two/manager";
import type { CardCode } from "../../big-two/logic";
import { buildGameInviteCard } from "../../big-two/messages";
import { liffUrlWithGroupId } from "../../line/partyMenu";
import { pushMessagesWithLimit } from "../../line/push";
import { logger } from "../../utils/logger";

/**
 * 大老二的 REST API，給 liff/big-two/bigTwo.js 呼叫。
 * 短輪詢架構（沒有 WebSocket）：/state 由前端固定間隔呼叫拉最新桌況，其他會動到資料的
 * endpoint 都要求 LIFF ID token，每次請求重新驗證（見 src/line/idToken.ts 的說明）。
 * leaderboard 是唯讀、不含敏感資訊，不需要驗證身分。
 */

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch((err) => {
      logger.error({ err, path: req.path }, "big-two API handler failed");
      res.status(500).json({ error: "internal server error" });
      next();
    });
  };
}

async function resolveMember(idToken: unknown, groupId: unknown, res: Response) {
  if (typeof idToken !== "string" || typeof groupId !== "string" || groupId.length === 0) {
    res.status(400).json({ error: "idToken and groupId are required" });
    return null;
  }
  if (!isValidLineGroupId(groupId)) {
    logger.warn({ groupId }, "big-two API received a malformed groupId, rejecting");
    res.status(400).json({ error: "invalid groupId format" });
    return null;
  }

  const verified = await verifyLineIdToken(idToken);
  if (!verified) {
    res.status(401).json({ error: "invalid id token" });
    return null;
  }

  return upsertGroupMemberByLineIds(groupId, verified.lineUserId);
}

export function createBigTwoRouter(): Router {
  const router = Router();

  router.get("/config", (_req, res) => {
    const env = loadEnv();
    res.status(200).json({ liffId: env.LIFF_ID_BIG_TWO ?? null });
  });

  router.post(
    "/state",
    asyncHandler(async (req, res) => {
      const { idToken, groupId } = req.body ?? {};
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const state = await getStateView(resolved.group.id, resolved.member);
      res.status(200).json(state);
    }),
  );

  router.post(
    "/create",
    asyncHandler(async (req, res) => {
      const { idToken, groupId, seatCount } = req.body ?? {};
      const resolvedSeatCount: SeatCount = VALID_SEAT_COUNTS.includes(seatCount) ? seatCount : 4;

      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await createGame(resolved.group.id, resolved.member, resolvedSeatCount);
      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }
      res.status(200).json(result.state);

      // 開局通知晚一點送、不擋著回應——揪團訊息送失敗（例如超過每小時推播上限、
      // 機器人被踢出群組）不該讓「開局」這個動作本身失敗。
      const env = loadEnv();
      if (env.LIFF_ID_BIG_TWO) {
        const liffUrl = liffUrlWithGroupId(env.LIFF_ID_BIG_TWO, resolved.group.lineGroupId);
        const hostName = resolved.member.displayName ?? "神秘玩家";
        const card = buildGameInviteCard(hostName, resolvedSeatCount, liffUrl);
        pushMessagesWithLimit(resolved.group.lineGroupId, [card]).catch((err) => {
          logger.warn({ err, groupId: resolved.group.id }, "failed to push big-two game invite");
        });
      }
    }),
  );

  router.post(
    "/join",
    asyncHandler(async (req, res) => {
      const { idToken, groupId } = req.body ?? {};
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await joinGame(resolved.group.id, resolved.member);
      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }
      res.status(200).json(result.state);
    }),
  );

  router.post(
    "/configure",
    asyncHandler(async (req, res) => {
      const { idToken, groupId, botCount } = req.body ?? {};
      if (typeof botCount !== "number" || !Number.isFinite(botCount)) {
        res.status(400).json({ error: "botCount is required" });
        return;
      }
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await setBotCount(resolved.group.id, resolved.member, botCount);
      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }
      res.status(200).json(result.state);
    }),
  );

  router.post(
    "/start",
    asyncHandler(async (req, res) => {
      const { idToken, groupId } = req.body ?? {};
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await startGame(resolved.group.id, resolved.member);
      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }
      res.status(200).json(result.state);
    }),
  );

  router.post(
    "/play",
    asyncHandler(async (req, res) => {
      const { idToken, groupId, cards } = req.body ?? {};
      if (!Array.isArray(cards) || cards.length === 0 || !cards.every((c) => typeof c === "string")) {
        res.status(400).json({ error: "cards is required" });
        return;
      }
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await playCards(resolved.group.id, resolved.member, cards as CardCode[]);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.status(200).json(result.state);
    }),
  );

  router.post(
    "/pass",
    asyncHandler(async (req, res) => {
      const { idToken, groupId } = req.body ?? {};
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await passTurn(resolved.group.id, resolved.member);
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.status(200).json(result.state);
    }),
  );

  router.get(
    "/leaderboard",
    asyncHandler(async (req, res) => {
      const groupId = req.query.groupId;
      if (typeof groupId !== "string" || groupId.length === 0) {
        res.status(400).json({ error: "groupId is required" });
        return;
      }

      const group = await prisma.group.findUnique({ where: { lineGroupId: groupId } });
      if (!group) {
        res.status(200).json({ date: null, entries: [] });
        return;
      }

      const leaderboard = await getLeaderboard(group.id);
      res.status(200).json(leaderboard);
    }),
  );

  router.get(
    "/leaderboard/all-time",
    asyncHandler(async (req, res) => {
      const groupId = req.query.groupId;
      if (typeof groupId !== "string" || groupId.length === 0) {
        res.status(400).json({ error: "groupId is required" });
        return;
      }

      const group = await prisma.group.findUnique({ where: { lineGroupId: groupId } });
      if (!group) {
        res.status(200).json({ entries: [] });
        return;
      }

      const entries = await getAllTimeTopThree(group.id);
      res.status(200).json({ entries });
    }),
  );

  return router;
}
