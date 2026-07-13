import { Router } from "express";

/**
 * Shared REST API surface for the (future) LIFF frontend.
 * MVP only exposes a healthcheck; game/leaderboard endpoints land alongside
 * the LIFF UI work.
 */
export function createApiRouter(): Router {
  const router = Router();

  router.get("/ping", (_req, res) => {
    res.status(200).json({ pong: true });
  });

  return router;
}
