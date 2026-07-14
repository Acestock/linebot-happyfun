/**
 * 小聚指令解析（純字串處理，無 I/O）。
 *
 * 指令一律是純文字（不用「/」前綴）。這代表跟一般聊天或其他遊戲文字撞詞的風險
 * 比斜線指令高，所以呼叫端（manager.ts）對「下一步」「跳過」這種短詞、且跟
 * 其他遊戲的關鍵字重複（例如問答遊戲的「跳過」）的指令，在沒有進行中的小聚時
 * 會靜默不回應，而不是主動提示「沒有小聚」，降低誤觸的干擾。
 */

export type HostCommand =
  | "create"
  | "start"
  | "next"
  | "skip"
  | "change_question"
  | "pause"
  | "resume"
  | "end"
  | "cancel";

const HOST_COMMAND_TEXT: Record<string, HostCommand> = {
  建立小聚: "create",
  開始小聚: "start",
  下一步: "next",
  跳過: "skip",
  換題目: "change_question",
  暫停小聚: "pause",
  繼續小聚: "resume",
  結束小聚: "end",
  取消小聚: "cancel",
};

/** postback 用的短代碼（LINE postback data 有長度限制，且不需要跟文字指令共用字串） */
const HOST_COMMAND_CODE: Record<string, HostCommand> = {
  start: "start",
  next: "next",
  skip: "skip",
  change: "change_question",
  pause: "pause",
  resume: "resume",
  end: "end",
  cancel: "cancel",
};

/** 這些指令詞短、容易跟其他系統的關鍵字撞在一起（例如問答遊戲也用「跳過」跳題），
 * 沒有進行中的小聚時應該靜默不回應，讓訊息自然往下一個系統流過去。 */
export const AMBIGUOUS_HOST_COMMANDS: ReadonlySet<HostCommand> = new Set(["next", "skip"]);

export function parseHostCommandFromText(text: string): HostCommand | null {
  return HOST_COMMAND_TEXT[text.trim()] ?? null;
}

export function parseHostCommandFromCode(code: string): HostCommand | null {
  return HOST_COMMAND_CODE[code] ?? null;
}

export const STATUS_COMMAND = "小聚狀態";
export const HELP_COMMAND = "小聚說明";
const CHECKIN_PREFIX = "簽到";
const CHECKIN_PHRASE = "我到了";
const FEEDBACK_PHRASES = new Set(["很喜歡", "還不錯", "可以更好"]);

export function isStatusCommand(text: string): boolean {
  return text.trim() === STATUS_COMMAND;
}

export function isHelpCommand(text: string): boolean {
  return text.trim() === HELP_COMMAND;
}

export interface CheckinInput {
  text: string | null;
  /** true：使用者主動輸入「簽到」類指令；false：只是說了「我到了」這種被動短語 */
  explicit: boolean;
}

/** `簽到 今天很期待` 或單純 `簽到`；也接受 Quick Reply 送出的「我到了」 */
export function parseCheckin(text: string): CheckinInput | null {
  const trimmed = text.trim();
  if (trimmed === CHECKIN_PHRASE) return { text: null, explicit: false };
  if (trimmed === CHECKIN_PREFIX) return { text: null, explicit: true };
  if (trimmed.startsWith(`${CHECKIN_PREFIX} `)) {
    const rest = trimmed.slice(CHECKIN_PREFIX.length).trim();
    return { text: rest.length > 0 ? rest : null, explicit: true };
  }
  return null;
}

export function parseFeedback(text: string): string | null {
  const trimmed = text.trim();
  return FEEDBACK_PHRASES.has(trimmed) ? trimmed : null;
}
