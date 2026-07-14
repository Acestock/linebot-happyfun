export type CopyIntent =
  | "opening"
  | "result"
  | "cancel"
  | "idle_nudge"
  | "topic_opening"
  | "topic_chime"
  | "topic_summary"
  | "wordchain_chime"
  | "wordchain_summary";

export interface GenerateInput {
  systemPrompt: string;
  userPrompt: string;
  /** 預設 200；出題這種結構化輸出需要更大 */
  maxTokens?: number;
  /** 預設 4000ms */
  timeoutMs?: number;
  /** 預設 0.9；出題想要更多樣可以調高 */
  temperature?: number;
}

export interface LLMClient {
  /** 回傳生成文字；失敗或逾時應 throw */
  generate(input: GenerateInput): Promise<string>;
}
