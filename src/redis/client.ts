import Redis from "ioredis";
import { loadEnv } from "../config/env";

let client: Redis | undefined;

export function getRedis(): Redis {
  if (!client) {
    const env = loadEnv();
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
  }
  return client;
}
