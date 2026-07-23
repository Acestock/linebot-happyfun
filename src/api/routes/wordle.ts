import { Router, type Request, type RequestHandler, type Response } from "express";
import { loadEnv } from "../../config/env";
import { verifyLineIdToken } from "../../line/idToken";
import { isValidLineGroupId, upsertGroupMemberByLineIds } from "../../db/groupRepository";
import { prisma } from "../../db/prisma";
import { getLeaderboard, getSessionState, startNextRound, submitGuess } from "../../wordle/manager";
import { logger } from "../../utils/logger";

/**
 * 每日 Wordle 的 REST API，給 liff/wordle.js 呼叫。
 * session/guess/next-round 三個會動到資料的 endpoint 都要求 LIFF ID token，每次請求
 * 重新驗證（見 src/line/idToken.ts 的說明：故意不做自訂 session token，換一點延遲省掉
 * 一整類簽章邏輯）。leaderboard 是唯讀、不含敏感資訊，不需要驗證身分。
 */

// Express 4 對 async route handler 裡的 rejection 不會自動轉給錯誤處理中介層，手動包一層。
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch((err) => {
      logger.error({ err, path: req.path }, "wordle API handler failed");
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
    logger.warn({ groupId }, "wordle API received a malformed groupId, rejecting");
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

export function createWordleRouter(): Router {
  const router = Router();

  // liff/wordle.js 開頭要呼叫 liff.init({ liffId })，liffId 不是機密（本來就會嵌在網址裡），
  // 用這個小 endpoint 讓靜態前端不用寫死環境變數，同一份靜態檔案可以指到不同環境的後端。
  router.get("/config", (_req, res) => {
    const env = loadEnv();
    res.status(200).json({ liffId: env.LIFF_ID ?? null });
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
