export type CopyIntent =
  | "opening"
  | "result"
  | "cancel"
  | "idle_nudge"
  | "topic_opening"
  | "topic_chime"
  | "topic_summary";

export interface GenerateInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface LLMClient {
  /** 回傳生成文字；失敗或逾時應 throw */
  generate(input: GenerateInput): Promise<string>;
}
