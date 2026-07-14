import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { getMemorySnippets } from "../memory/groupMemory";
import { buildSystemPrompt, buildUserPrompt } from "./personaPrompt";
import { moderateCopy } from "./moderation";
import { OpenAIClient } from "./openaiClient";
import type { CopyIntent, LLMClient } from "./types";

const MAX_ATTEMPTS = 2;

let defaultClient: LLMClient | undefined;

function getClient(): LLMClient {
  if (!defaultClient) {
    defaultClient = new OpenAIClient();
  }
  return defaultClient;
}

/**
 * 產生人設文案。任何一步失敗（沒 API key、逾時、API 錯誤、兩次都被
 * moderation 擋下）都回傳 fallback，遊戲流程永遠不會被卡住。
 */
export async function generateCopy(
  intent: CopyIntent,
  context: Record<string, unknown>,
  fallback: string,
  groupId: string,
  client: LLMClient = getClient(),
): Promise<string> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) {
    return fallback;
  }

  const memorySnippets = await getMemorySnippets(groupId);
  const input = {
    systemPrompt: buildSystemPrompt(memorySnippets),
    userPrompt: buildUserPrompt(intent, context),
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const raw = await client.generate(input);
      const moderated = moderateCopy(raw);
      logger.info(
        { intent, attempt, latencyMs: Date.now() - startedAt, passed: moderated !== null },
        "llm copy generated",
      );
      if (moderated !== null) {
        return moderated;
      }
    } catch (err) {
      logger.warn(
        { err, intent, attempt, latencyMs: Date.now() - startedAt },
        "llm copy generation failed",
      );
    }
  }

  return fallback;
}
