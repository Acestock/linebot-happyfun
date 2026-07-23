import { Router, type Request, type RequestHandler, type Response } from "express";
import { loadEnv } from "../../config/env";
import { verifyLineIdToken } from "../../line/idToken";
import { isValidLineGroupId, upsertGroupMemberByLineIds } from "../../db/groupRepository";
import { prisma } from "../../db/prisma";
import { getLeaderboard, getSessionState, startNextRound, submitGuess } from "../../one-a-two-b/manager";
import { logger } from "../../utils/logger";

/**
 * 每日 1A2B 的 REST API，給 liff/one-a-two-b/oneATwoB.js 呼叫。
 * 跟 src/api/routes/wordle.ts 是同一套設計——session/guess/next-round 三個會動到資料的
 * endpoint 都要求 LIFF ID token，每次請求重新驗證（見 src/line/idToken.ts，故意不做自訂
 * session token）；leaderboard 是唯讀、不含敏感資訊，不需要驗證身分。
 */

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch((err) => {
      logger.error({ err, path: req.path }, "one-a-two-b API handler failed");
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
    // 不是合法的 LINE 群組 ID 格式（例如前端不小心送了我們自己的內部 UUID）——直接擋下來，
    // 不要讓它在資料庫裡建立一筆對不上真實群組的「影子群組」。
    logger.warn({ groupId }, "one-a-two-b API received a malformed groupId, rejecting");
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

export function createOneATwoBRouter(): Router {
  const router = Router();

  // liff/one-a-two-b/oneATwoB.js 開頭要呼叫 liff.init({ liffId })，liffId 不是機密，
  // 用這個小 endpoint 讓靜態前端不用寫死環境變數。
  router.get("/config", (_req, res) => {
    const env = loadEnv();
    res.status(200).json({ liffId: env.LIFF_ID_ONE_A_TWO_B ?? null });
  });

  router.post(
    "/session",
    asyncHandler(async (req, res) => {
      const { idToken, groupId } = req.body ?? {};
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const state = await getSessionState(resolved.group.id, resolved.member);
      res.status(200).json({ ...state, displayName: resolved.member.displayName });
    }),
  );

  router.post(
    "/next-round",
    asyncHandler(async (req, res) => {
      const { idToken, groupId } = req.body ?? {};
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await startNextRound(resolved.group.id, resolved.member);
      if (!result.ok) {
        res.status(409).json({ error: result.error });
        return;
      }
      res.status(200).json(result.state);
    }),
  );

  router.post(
    "/guess",
    asyncHandler(async (req, res) => {
      const { idToken, groupId, guess } = req.body ?? {};
      if (typeof guess !== "string" || guess.length === 0) {
        res.status(400).json({ error: "guess is required" });
        return;
      }
      const resolved = await resolveMember(idToken, groupId, res);
      if (!resolved) return;

      const result = await submitGuess(resolved.group.id, resolved.member, guess);
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

  return router;
}
