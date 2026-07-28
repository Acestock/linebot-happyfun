import path from "node:path";
import { spawn } from "node:child_process";
import express, { type Express, type ErrorRequestHandler } from "express";
import { SignatureValidationFailed } from "@line/bot-sdk";
import { createLineWebhookRouter } from "./webhook/lineWebhook";
import { createApiRouter } from "./api/routes";
import { loadEnv } from "./config/env";
import { logger } from "./utils/logger";

const MIGRATE_RESOLVE_COMMAND_TIMEOUT_MS = 60_000;

function runPrismaCli(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
    const child = spawn(prismaBin, args, {
      env: { ...process.env, CHECKPOINT_DISABLE: "1" },
      timeout: MIGRATE_RESOLVE_COMMAND_TIMEOUT_MS,
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("close", (code, signal) => {
      resolve(`$ prisma ${args.join(" ")}\nexit code: ${code}${signal ? ` (killed by ${signal})` : ""}\n${output}\n`);
    });
    child.on("error", (err) => {
      resolve(`$ prisma ${args.join(" ")}\nfailed to spawn: ${err.message}\n`);
    });
  });
}

export function createApp(): Express {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  /**
   * 沒有本機／Railway CLI 可以連正式環境資料庫時的最後手段：一個 migration 卡在
   * failed 狀態會擋住所有後續的 `prisma migrate deploy`（背景開機時跑的那個，見
   * src/db/migrate.ts），沒辦法連進資料庫手動下 `prisma migrate resolve` 就永遠
   * 卡死。這條路只有設了 MIGRATE_RESOLVE_TOKEN 才會存在（沒設就直接 404，當作
   * 這條路不存在），用完建議把這個環境變數刪掉再收工。
   */
  app.get("/internal/migrate-resolve", async (req, res) => {
    const env = loadEnv();
    if (!env.MIGRATE_RESOLVE_TOKEN || req.query.token !== env.MIGRATE_RESOLVE_TOKEN) {
      res.status(404).end();
      return;
    }

    const migration = req.query.migration;
    if (typeof migration !== "string" || !/^[A-Za-z0-9_]+$/.test(migration)) {
      res.status(400).type("text/plain").send("缺少或格式不對的 ?migration=<migration資料夾名稱>");
      return;
    }
    const mode = req.query.mode === "applied" ? "--applied" : "--rolled-back";

    logger.warn({ migration, mode }, "manual migrate-resolve triggered via /internal/migrate-resolve");
    const resolveOutput = await runPrismaCli(["migrate", "resolve", mode, migration]);
    const deployOutput = await runPrismaCli(["migrate", "deploy"]);
    res.status(200).type("text/plain").send(`${resolveOutput}\n${deployOutput}`);
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
