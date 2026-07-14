import {
  ICEBREAKER_CATEGORY_LABELS,
  INTERACTION_TYPE_LABELS,
  type IcebreakerCategory,
  type InteractionType,
} from "./questionBanks";

/**
 * 建立小聚時的問答精靈 — 純邏輯（解析使用者輸入、決定下一步問什麼），無 I/O。
 */

export type SetupStep =
  | "name"
  | "time"
  | "custom_time"
  | "style"
  | "icebreaker"
  | "custom_icebreaker_text"
  | "interaction";

export const FIRST_SETUP_STEP: SetupStep = "name";

export const TIME_OPTIONS = ["30 分鐘", "60 分鐘", "90 分鐘", "自訂"] as const;
export const STYLE_OPTIONS = ["輕鬆", "活潑", "溫和", "正式"] as const;

const ICEBREAKER_OPTION_TO_CATEGORY: Record<string, IcebreakerCategory> = Object.fromEntries(
  Object.entries(ICEBREAKER_CATEGORY_LABELS).map(([code, label]) => [label, code as IcebreakerCategory]),
);
export const ICEBREAKER_OPTIONS = Object.values(ICEBREAKER_CATEGORY_LABELS);

const INTERACTION_OPTION_TO_TYPE: Record<string, InteractionType> = Object.fromEntries(
  Object.entries(INTERACTION_TYPE_LABELS).map(([code, label]) => [label, code as InteractionType]),
);
export const INTERACTION_OPTIONS = Object.values(INTERACTION_TYPE_LABELS);

export function parseTimeOption(text: string): number | "custom" | null {
  const trimmed = text.trim();
  if (trimmed === "自訂") return "custom";
  const match = trimmed.match(/^(\d+)\s*分鐘$/);
  if (match && TIME_OPTIONS.includes(trimmed as (typeof TIME_OPTIONS)[number])) {
    return Number(match[1]);
  }
  return null;
}

export function parseCustomMinutes(text: string): number | null {
  const trimmed = text.trim().replace(/\s*分鐘$/, "").trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  if (minutes < 5 || minutes > 480) return null;
  return minutes;
}

export function parseStyleOption(text: string): string | null {
  const trimmed = text.trim();
  return (STYLE_OPTIONS as readonly string[]).includes(trimmed) ? trimmed : null;
}

export function parseIcebreakerOption(text: string): IcebreakerCategory | null {
  return ICEBREAKER_OPTION_TO_CATEGORY[text.trim()] ?? null;
}

export function parseInteractionOption(text: string): InteractionType | null {
  return INTERACTION_OPTION_TO_TYPE[text.trim()] ?? null;
}

/** 依目前的 step 和剛才收到的答案，決定下一個 step（null 代表精靈完成，可以轉 READY） */
export function nextSetupStep(
  current: SetupStep,
  context: { icebreakerCategory?: IcebreakerCategory },
): SetupStep | null {
  switch (current) {
    case "name":
      return "time";
    case "time":
      return "style"; // custom_time 由呼叫端在解析到 "custom" 時特別插入，不走這條預設路徑
    case "custom_time":
      return "style";
    case "style":
      return "icebreaker";
    case "icebreaker":
      return context.icebreakerCategory === "custom" ? "custom_icebreaker_text" : "interaction";
    case "custom_icebreaker_text":
      return "interaction";
    case "interaction":
      return null;
  }
}
