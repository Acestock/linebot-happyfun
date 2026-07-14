import { loadEnv } from "../../config/env";
import { logger } from "../../utils/logger";
import { OpenAIClient } from "../../persona/openaiClient";
import type { LLMClient } from "../../persona/types";
import type { Round } from "./rounds";

const GEN_TIMEOUT_MS = 6000;
const GEN_MAX_TOKENS = 800;

let defaultClient: LLMClient | undefined;
function getClient(): LLMClient {
  if (!defaultClient) defaultClient = new OpenAIClient();
  return defaultClient;
}

interface RawQuestion {
  question?: unknown;
  answers?: unknown;
}

/** 驗證並清理 LLM 吐回來的 JSON，格式不對的題目直接丟棄 */
function parseRounds(raw: string, count: number): Round[] | null {
  let parsed: unknown;
  try {
    // 模型偶爾會包 ```json 區塊，先剝掉
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const rounds: Round[] = [];
  for (const item of parsed as RawQuestion[]) {
    if (typeof item.question !== "string" || item.question.trim().length === 0) continue;
    if (!Array.isArray(item.answers)) continue;
    const answers = item.answers.filter(
      (a): a is string => typeof a === "string" && a.trim().length > 0,
    );
    if (answers.length === 0) continue;
    rounds.push({ question: item.question.trim(), answers });
  }

  return rounds.length >= Math.min(3, count) ? rounds.slice(0, count) : null;
}

/**
 * 用 GPT-4o 生成一組結構化題目。任何一步失敗（沒 key、逾時、格式不對）
 * 都回傳 null，呼叫端要準備固定題庫當 fallback，遊戲永遠開得起來。
 */
export async function generateRounds(
  prompt: string,
  count: number,
  client: LLMClient = getClient(),
): Promise<Round[] | null> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) return null;

  const systemPrompt =
    `你是遊戲出題機，只輸出 JSON，不要有任何其他文字或說明、不要用 markdown 包裝。\n` +
    `輸出格式：一個 JSON 陣列，每個元素是 {"question": "題目文字", "answers": ["標準答案", "其他可接受的寫法"]}。\n` +
    `題目必須有明確、簡短、玩家打字就能回答的答案，不要出開放式或需要長篇解釋的題目。`;

  try {
    const raw = await client.generate({
      systemPrompt,
      userPrompt: `${prompt}\n\n請出 ${count} 題，直接輸出 JSON 陣列。`,
      maxTokens: GEN_MAX_TOKENS,
      timeoutMs: GEN_TIMEOUT_MS,
    });
    const rounds = parseRounds(raw, count);
    if (!rounds) {
      logger.warn({ prompt }, "question generation returned unusable format, using fallback");
    }
    return rounds;
  } catch (err) {
    logger.warn({ err, prompt }, "question generation failed, using fallback");
    return null;
  }
}
