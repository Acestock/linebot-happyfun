/**
 * 破冰題／互動題庫 — 靜態題庫，跟 games/quiz、games/emoji-riddle 的 fallback bank
 * 是同一種風格（純資料，無 I/O）。互動環節的流程控制永遠是狀態機說了算，不接 AI；
 * 破冰題目的「文字內容」則多了 ai_topic 這個選項，讓 AI 根據活動主題出題
 * （見 src/meetup/icebreakerAI.ts），LLM 沒設定或生成失敗時一律退回這裡的靜態題庫。
 */

export type IcebreakerCategory = "daily" | "interest" | "work" | "random" | "custom" | "ai_topic";

export const ICEBREAKER_CATEGORY_LABELS: Record<IcebreakerCategory, string> = {
  daily: "輕鬆日常",
  interest: "興趣交流",
  work: "工作交流",
  random: "隨機題目",
  custom: "主辦人自訂",
  ai_topic: "AI 根據主題出題",
};

const ICEBREAKER_BANK: Record<Exclude<IcebreakerCategory, "custom" | "random" | "ai_topic">, string[]> = {
  daily: [
    "最近有沒有一件讓你覺得「還好我有去做」的事情？",
    "這個禮拜吃過最好吃的一餐是什麼？",
    "最近有沒有养成或戒掉什麼小習慣？",
    "如果今天可以提早下班/下課，你想做什麼？",
    "最近一次讓你笑出來的事情是什麼？",
  ],
  interest: [
    "最近最常投入時間的一個興趣是什麼？",
    "有沒有一個你想入坑但還沒開始的興趣？",
    "如果可以立刻學會一項技能，你會選什麼？",
    "最近在追的一部劇/一首歌/一本書是什麼？",
    "你的興趣裡，最花錢的是哪一個？",
  ],
  work: [
    "最近工作/學業上一件覺得有成就感的小事是什麼？",
    "你覺得自己工作上最擅長的一件事是什麼？",
    "最近有沒有學到什麼新的工作方法或工具？",
    "如果可以換一個職業體驗一天，你想做什麼？",
    "工作日裡，你覺得哪個時段效率最好？",
  ],
};

/** custom/random 不是固定題庫：custom 由主辦人自己輸入；random 從其他分類混合抽 */
function randomIcebreakerPool(): string[] {
  return [...ICEBREAKER_BANK.daily, ...ICEBREAKER_BANK.interest, ...ICEBREAKER_BANK.work];
}

/**
 * 靜態題庫的最終退路。ai_topic 分類實際出題邏輯在 src/meetup/icebreakerAI.ts，
 * 這裡把它當 random 處理，作為 AI 沒設定或生成失敗時的保底（絕不讓破冰階段卡住）。
 */
export function pickIcebreaker(
  category: IcebreakerCategory,
  used: string[],
  customText?: string | null,
): string | null {
  if (category === "custom") {
    return customText ?? null;
  }
  const pool = category === "random" || category === "ai_topic" ? randomIcebreakerPool() : ICEBREAKER_BANK[category];
  const fresh = pool.filter((q) => !used.includes(q));
  const candidates = fresh.length > 0 ? fresh : pool;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export type InteractionType =
  | "quickfire"
  | "twochoice"
  | "topic"
  | "chain"
  | "random"
  | "none";

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  quickfire: "快問快答",
  twochoice: "二選一",
  topic: "主題分享",
  chain: "接龍",
  random: "隨機互動",
  none: "不安排互動環節",
};

const QUICKFIRE_BANK = [
  "快問快答：最近最常使用的一個 App 是什麼？",
  "快問快答：早餐通常都吃什麼？",
  "快問快答：出門在外最不能沒有的一樣東西是？",
  "快問快答：一句話形容你這禮拜？",
];

const TWO_CHOICE_BANK = [
  "二選一：旅行時你比較喜歡哪一種？\n\nA. 行程排得很完整\nB. 到現場再決定",
  "二選一：假日你比較想？\n\nA. 待在家耍廢\nB. 出門走走",
  "二選一：點餐時你比較常？\n\nA. 吃熟悉的菜色\nB. 嘗試新菜色",
  "二選一：工作/學習時你比較喜歡？\n\nA. 一個人專心做\nB. 跟大家一起討論",
];

const TOPIC_BANK = [
  "分享一個你最近正在研究、學習或嘗試的新事物。",
  "分享一個最近讓你印象深刻的小發現。",
  "分享一個你覺得大家都應該試試看的東西。",
];

const CHAIN_PROMPT =
  "來玩一輪輕鬆接龍。\n\n請用上一位回答的最後一個字，說出一個新的詞語。想不到也可以直接跳過。";

const INTERACTION_BANKS: Record<Exclude<InteractionType, "random" | "none" | "chain">, string[]> = {
  quickfire: QUICKFIRE_BANK,
  twochoice: TWO_CHOICE_BANK,
  topic: TOPIC_BANK,
};

/** random 類型先隨機決定要玩哪一種子類型，回傳實際類型與題目 */
export function pickInteractionPrompt(
  type: InteractionType,
  used: string[],
): { resolvedType: InteractionType; prompt: string } | null {
  if (type === "none") return null;

  if (type === "chain") {
    return { resolvedType: "chain", prompt: CHAIN_PROMPT };
  }

  const resolvedType: Exclude<InteractionType, "random" | "none" | "chain"> =
    type === "random"
      ? (["quickfire", "twochoice", "topic"] as const)[Math.floor(Math.random() * 3)]
      : type;

  const pool = INTERACTION_BANKS[resolvedType];
  const fresh = pool.filter((q) => !used.includes(q));
  const candidates = fresh.length > 0 ? fresh : pool;
  if (candidates.length === 0) return null;
  const prompt = candidates[Math.floor(Math.random() * candidates.length)];
  return { resolvedType, prompt };
}
