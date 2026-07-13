import "dotenv/config";
import { loadEnv } from "./config/env";
import { createApp } from "./app";
import { logger } from "./utils/logger";

const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "linebot-happyfun server started");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
  });
}
