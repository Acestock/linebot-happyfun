console.log("[boot] index.ts starting");

import "dotenv/config";

process.on("uncaughtException", (err) => {
  console.error("[boot] uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[boot] unhandledRejection", reason);
  process.exit(1);
});

async function main() {
  console.log("[boot] loading env");
  const { loadEnv } = await import("./config/env");
  const env = loadEnv();

  console.log("[boot] env loaded, creating app", { port: env.PORT, nodeEnv: env.NODE_ENV });
  const { createApp } = await import("./app");
  const { logger } = await import("./utils/logger");
  const app = createApp();

  const HOST = "0.0.0.0";

  console.log("[boot] calling app.listen", { host: HOST, port: env.PORT });
  const server = app.listen(env.PORT, HOST, () => {
    logger.info({ host: HOST, port: env.PORT, env: env.NODE_ENV }, "linebot-happyfun server started");

    // Migrations run AFTER the server is accepting connections, so a slow
    // or wedged Prisma CLI can never block startup or the healthcheck.
    const { runMigrationsInBackground } = require("./db/migrate") as typeof import("./db/migrate");
    runMigrationsInBackground();
  });

  server.on("error", (err) => {
    console.error("[boot] server.listen error", err);
    process.exit(1);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      logger.info({ signal }, "Shutting down");
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error("[boot] fatal error during startup", err);
  process.exit(1);
});
