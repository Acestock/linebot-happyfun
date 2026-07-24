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

  // 各階段時間快到時主動提醒主辦人，只提醒不自動推進（流程仍完全由主辦人手動控制）。預設開啟。
  MEETUP_PHASE_REMINDER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  MEETUP_PHASE_REMINDER_LEAD_MINUTES: z.coerce.number().default(5),
  MEETUP_PHASE_REMINDER_SWEEP_INTERVAL_MINUTES: z.coerce.number().default(5),

  INTERNAL_STATS_TOKEN: z.string().optional(),
  // 每日 Wordle 用的 LIFF app ID
  LIFF_ID: z.string().optional(),
  // 每日 1A2B 用的 LIFF app ID——每個 LIFF 網頁小遊戲都要在同一個 LINE Login channel
  // 底下各自申請一組（一個 LIFF app 只能對應一個固定網址），但共用同一個 LIFF_CHANNEL_ID
  LIFF_ID_ONE_A_TWO_B: z.string().optional(),
  // 大老二人機混合對戰用的 LIFF app ID
  LIFF_ID_BIG_TWO: z.string().optional(),
  // LIFF app 掛載的 Channel ID（數字），驗證 LIFF ID token 時當 client_id 用，同一個
  // LINE Login channel 底下的所有 LIFF app 共用這一個值。
  // 跟 LINE_CHANNEL_SECRET 不同東西，在 LINE Developers Console 的 LIFF 分頁可以找到。
  LIFF_CHANNEL_ID: z.string().optional(),
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
