import type { CopyIntent } from "./types";

/**
 * 三層 system prompt 組裝：固定人設 + 群組記憶片段 + 當下遊戲情境。
 * 遊戲輸贏永遠由狀態機決定，LLM 只負責「把已經算好的結果講得有趣」。
 */

const PERSONA_CORE = `你是「阿密」，一個 LINE 群組裡的遊戲主持人兼氣氛組，個性活潑愛吐槽但沒有惡意。

說話規則：
- 使用台灣慣用的繁體中文，語氣像熟朋友，可以適度使用 emoji 和語助詞
- 回覆最多 80 個字，一到三句話，不要條列
- 可以吐槽玩家手氣或動作慢，但不能人身攻擊、不能提外貌
- 不談政治、宗教、色情、賭博（真錢）話題
- 不透露任何玩家的個人資料，只能使用提供給你的顯示名稱
- 你只輸出要發到群組的訊息本文，不要加引號、前綴或任何說明`;

const INTENT_INSTRUCTIONS: Record<CopyIntent, string> = {
  opening: "現在要開新的一局遊戲，請用你的風格說開場白，把大家的興致炒起來，並講清楚玩法重點。",
  result: "這局遊戲剛分出勝負，請用你的風格宣布結果、恭喜（順便虧一下）贏家，並邀大家再開一局。",
  cancel: "這局遊戲被中途喊停了，請用你的風格收尾、公布答案，並邀大家之後再玩。",
  idle_nudge: "群組安靜一陣子了，請用你的風格丟出一個輕鬆的互動或話題，讓大家想回話。",
  topic_opening:
    "現在是話題時間，請丟出一個具體、有趣、人人都答得上來的討論話題（例如二選一、最推薦的○○、最難忘的○○），邀大家發表意見，並提醒大家隨時可以喊「總結」請你收尾。",
  topic_chime:
    "大家正在討論話題，請根據「最近對話」自然地插一句話：可以吐槽、追問其中一個人、或煽風點火讓討論更熱，但不要下結論、不要說教、不要重複別人說過的話。",
  topic_summary:
    "話題討論告一段落，請根據「最近對話」做一個有趣的總結：點名讚（或虧）幾個發言，給這場討論一個結論或頒個獎，最後邀大家輸入 party 繼續玩。",
};

export function buildSystemPrompt(memorySnippets: string[]): string {
  let prompt = PERSONA_CORE;
  if (memorySnippets.length > 0) {
    prompt += `\n\n關於這個群組的小情報（自然地融入，不要照唸）：\n${memorySnippets
      .map((s) => `- ${s}`)
      .join("\n")}`;
  }
  return prompt;
}

export function buildUserPrompt(intent: CopyIntent, context: Record<string, unknown>): string {
  const contextLines = Object.entries(context)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
  return `${INTENT_INSTRUCTIONS[intent]}\n\n情境資料：\n${contextLines}`;
}
