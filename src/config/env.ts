import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),

  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1, "LINE_CHANNEL_ACCESS_TOKEN is required"),
  LINE_CHANNEL_SECRET: z.string().min(1, "LINE_CHANNEL_SECRET is required"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  LLM_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  LLM_MODEL: z.string().default("gpt-4o"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  PUSH_RATE_LIMIT_PER_GROUP_PER_HOUR: z.coerce.number().default(2),
  IDLE_NUDGE_THRESHOLD_MINUTES: z.coerce.number().default(180),
  IDLE_NUDGE_SWEEP_INTERVAL_MINUTES: z.coerce.number().default(30),
  // 預設關閉：所有互動一律由使用者輸入 party 主動觸發
  IDLE_NUDGE_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  GAME_TIMEOUT_MINUTES: z.coerce.number().default(10),
  GAME_TIMEOUT_SWEEP_INTERVAL_MINUTES: z.coerce.number().default(2),

  // 付費功能的可靠度保險絲：主辦人忘記結束小聚時自動收攤，預設開啟（跟 IDLE_NUDGE 不同，
  // 這不是行銷性質的主動搭話，是避免群組的 party/遊戲功能被卡住忘記關閉）
  MEETUP_IDLE_TIMEOUT_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  MEETUP_IDLE_TIMEOUT_MINUTES: z.coerce.number().default(180),
  MEETUP_IDLE_SWEEP_INTERVAL_MINUTES: z.coerce.number().default(15),

  INTERNAL_STATS_TOKEN: z.string().optional(),
  LIFF_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
