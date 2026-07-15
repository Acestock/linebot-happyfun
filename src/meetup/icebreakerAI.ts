import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";
import { moderateCopy } from "../persona/moderation";
import { OpenAIClient } from "../persona/openaiClient";
import type { LLMClient } from "../persona/types";

/**
 * 破冰題「ai_topic」分類專用的出題器。跟 persona/generator.ts 是分開的兩套系統：
 * persona 那套是遊戲主持人「阿密」的固定人設吐槽風格，這裡只需要出一題跟活動主題
 * 相關的正經破冰問題，語氣、規則都不一樣，硬共用同一個 system prompt 反而不合適。
 *
 * 任何一步失敗（沒 API key、逾時、API 錯誤、兩次都被 moderation 擋下）都回傳
 * null，呼叫端（src/meetup/manager.ts）永遠有靜態題庫可以退回，破冰階段不會被卡住。
 */

const MAX_ATTEMPTS = 2;

let defaultClient: LLMClient | undefined;

function getClient(): LLMClient {
  if (!defaultClient) {
    defaultClient = new OpenAIClient();
  }
  return defaultClient;
}

const SYSTEM_PROMPT = `你是一個小型聚會的破冰題設計師，只負責出一題破冰問題，不做任何其他事。

規則：
- 使用台灣慣用的繁體中文
- 題目必須跟給定的「活動主題」明確相關，讓參加者容易順著主題聊起來
- 題目控制在一句話以內，40 字以內，以問句結尾
- 題目要讓所有人都答得上來，不要太抽象、太私密或太專業
- 不談政治、宗教、色情、賭博（真錢）話題，不能涉及個資或隱私
- 只輸出題目本身，不要加引號、編號、前綴或任何說明`;

function buildUserPrompt(topic: string, hostStyle: string, avoid: string[]): string {
  let prompt = `活動主題：${topic}\n主持風格：${hostStyle}`;
  if (avoid.length > 0) {
    prompt += `\n\n這場活動已經問過以下題目，請出一題不同的，不要重複或太相似：\n${avoid
      .map((q) => `- ${q}`)
      .join("\n")}`;
  }
  return prompt;
}

export async function generateAiIcebreaker(
  topic: string,
  hostStyle: string,
  avoid: string[],
  client: LLMClient = getClient(),
): Promise<string | null> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) return null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const raw = await client.generate({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(topic, hostStyle, avoid),
      });
      const moderated = moderateCopy(raw);
      logger.info(
        { attempt, latencyMs: Date.now() - startedAt, passed: moderated !== null },
        "ai icebreaker generated",
      );
      if (moderated !== null) return moderated;
    } catch (err) {
      logger.warn({ err, attempt, latencyMs: Date.now() - startedAt }, "ai icebreaker generation failed");
    }
  }

  return null;
}
