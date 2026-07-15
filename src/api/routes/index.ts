import { Router } from "express";
import { createWordleRouter } from "./wordle";

/**
 * Shared REST API surface for the LIFF frontend (liff/).
 */
export function createApiRouter(): Router {
  const router = Router();

  router.get("/ping", (_req, res) => {
    res.status(200).json({ pong: true });
  });

  router.use("/wordle", createWordleRouter());

  return router;
}
