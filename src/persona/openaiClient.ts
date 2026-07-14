import { loadEnv } from "../config/env";
import type { GenerateInput, LLMClient } from "./types";

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_MAX_TOKENS = 200;

export class OpenAIClient implements LLMClient {
  async generate(input: GenerateInput): Promise<string> {
    const env = loadEnv();
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.LLM_MODEL,
          temperature: 0.9,
          max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI API returned empty content");
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}
