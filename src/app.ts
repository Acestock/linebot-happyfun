import path from "node:path";
import express, { type Express, type ErrorRequestHandler } from "express";
import { SignatureValidationFailed } from "@line/bot-sdk";
import { createLineWebhookRouter } from "./webhook/lineWebhook";
import { createApiRouter } from "./api/routes";
import { logger } from "./utils/logger";

export function createApp(): Express {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // LINE webhook must read the raw body itself for signature verification,
  // so it is mounted before any global JSON body parser.
  app.use(createLineWebhookRouter());

  app.use("/api", express.json());
  app.use("/api", createApiRouter());

  // LIFF frontend: independent static project (liff/), not part of the TS build
  // (see tsconfig.json exclude + docs/ARCHITECTURE.md) — served by this same Express
  // service to avoid paying for a second Railway service.
  app.use("/liff", express.static(path.join(__dirname, "../liff")));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof SignatureValidationFailed) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
    logger.error({ err }, "Unhandled request error");
    res.status(500).json({ error: "internal server error" });
  };
  app.use(errorHandler);

  return app;
}
