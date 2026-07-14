import { spawn } from "node:child_process";
import path from "node:path";

const MIGRATE_TIMEOUT_MS = 60_000;

/**
 * Runs `prisma migrate deploy` as a child process after the server is
 * already listening. The server must never be held hostage by the Prisma
 * CLI (which has been observed printing its final line and then never
 * exiting in some container environments), so the child gets a hard
 * timeout and any failure is logged instead of thrown.
 */
export function runMigrationsInBackground(): void {
  const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
  console.log("[boot] starting prisma migrate deploy (background)");

  const child = spawn(prismaBin, ["migrate", "deploy"], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: MIGRATE_TIMEOUT_MS,
    env: { ...process.env, CHECKPOINT_DISABLE: "1" },
  });

  child.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(`[migrate] ${chunk.toString()}`);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(`[migrate:err] ${chunk.toString()}`);
  });

  child.on("error", (err) => {
    console.error("[migrate] failed to spawn prisma CLI", err);
  });

  child.on("close", (code, signal) => {
    if (signal) {
      console.error(`[migrate] prisma migrate deploy killed by ${signal} (timeout ${MIGRATE_TIMEOUT_MS}ms)`);
    } else if (code !== 0) {
      console.error(`[migrate] prisma migrate deploy exited with code ${code}`);
    } else {
      console.log("[migrate] prisma migrate deploy finished successfully");
    }
  });
}
