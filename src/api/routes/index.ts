import { Router } from "express";
import { createWordleRouter } from "./wordle";
import { createOneATwoBRouter } from "./oneATwoB";
import { createBigTwoRouter } from "./bigTwo";

/**
 * Shared REST API surface for the LIFF frontend (liff/).
 */
export function createApiRouter(): Router {
  const router = Router();

  router.get("/ping", (_req, res) => {
    res.status(200).json({ pong: true });
  });

  router.use("/wordle", createWordleRouter());
  router.use("/one-a-two-b", createOneATwoBRouter());
  router.use("/big-two", createBigTwoRouter());

  return router;
}
