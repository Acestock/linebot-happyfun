export type CopyIntent = "opening" | "result" | "cancel" | "idle_nudge";

export interface GenerateInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface LLMClient {
  /** 回傳生成文字；失敗或逾時應 throw */
  generate(input: GenerateInput): Promise<string>;
}
