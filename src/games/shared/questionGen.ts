import { loadEnv } from "../../config/env";
import { logger } from "../../utils/logger";
import { OpenAIClient } from "../../persona/openaiClient";
import type { LLMClient } from "../../persona/types";
import type { Round } from "./rounds";

const GEN_TIMEOUT_MS = 6000;
const GEN_MAX_TOKENS = 800;
// 出題要多樣，故意調得比人設文案（0.9）更高，同一批 prompt 才不會每次都收斂到同幾題
const GEN_TEMPERATURE = 1.15;

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

export interface GenerateRoundsOptions {
  /** 隨機挑幾個主題塞進 prompt，逼模型別每次都想到同一批經典題 */
  categoryHint?: string;
  /** 這個群組最近出過的題目，提醒模型不要重複 */
  avoidQuestions?: string[];
}

/**
 * 用 GPT-4o 生成一組結構化題目。任何一步失敗（沒 key、逾時、格式不對）
 * 都回傳 null，呼叫端要準備固定題庫當 fallback，遊戲永遠開得起來。
 */
export async function generateRounds(
  prompt: string,
  count: number,
  options: GenerateRoundsOptions = {},
  client: LLMClient = getClient(),
): Promise<Round[] | null> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) return null;

  const systemPrompt =
    `你是遊戲出題機，只輸出 JSON，不要有任何其他文字或說明、不要用 markdown 包裝。\n` +
    `輸出格式：一個 JSON 陣列，每個元素是 {"question": "題目文字", "answers": ["標準答案", "其他可接受的寫法"]}。\n` +
    `題目必須有明確、簡短、玩家打字就能回答的答案，不要出開放式或需要長篇解釋的題目。\n` +
    `每次出題都要盡量跟一般制式題庫不同，避免只想得到最陳腔濫調的那幾題。`;

  let userPrompt = prompt;
  if (options.categoryHint) {
    userPrompt += `\n\n這次請把重點放在這些方向：${options.categoryHint}。`;
  }
  if (options.avoidQuestions && options.avoidQuestions.length > 0) {
    userPrompt += `\n\n以下題目最近才出過，這次絕對不要重複或出太像的：\n${options.avoidQuestions
      .map((q) => `- ${q}`)
      .join("\n")}`;
  }
  userPrompt += `\n\n請出 ${count} 題，直接輸出 JSON 陣列。`;

  try {
    const raw = await client.generate({
      systemPrompt,
      userPrompt,
      maxTokens: GEN_MAX_TOKENS,
      timeoutMs: GEN_TIMEOUT_MS,
      temperature: GEN_TEMPERATURE,
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
