/**
 * 小聚指令解析（純字串處理，無 I/O）。
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
  "/建立小聚": "create",
  "/開始小聚": "start",
  "/下一步": "next",
  "/跳過": "skip",
  "/換題目": "change_question",
  "/暫停小聚": "pause",
  "/繼續小聚": "resume",
  "/結束小聚": "end",
  "/取消小聚": "cancel",
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

export function parseHostCommandFromText(text: string): HostCommand | null {
  return HOST_COMMAND_TEXT[text.trim()] ?? null;
}

export function parseHostCommandFromCode(code: string): HostCommand | null {
  return HOST_COMMAND_CODE[code] ?? null;
}

export const STATUS_COMMAND = "/小聚狀態";
export const HELP_COMMAND = "/小聚說明";
const CHECKIN_PREFIX = "/簽到";
const CHECKIN_PHRASE = "我到了";
const FEEDBACK_PHRASES = new Set(["很喜歡", "還不錯", "可以更好"]);

export function isStatusCommand(text: string): boolean {
  return text.trim() === STATUS_COMMAND;
}

export function isHelpCommand(text: string): boolean {
  return text.trim() === HELP_COMMAND;
}

/** `/簽到 今天很期待` 或單純 `/簽到`；也接受 Quick Reply 送出的「我到了」 */
export function parseCheckin(text: string): { text: string | null } | null {
  const trimmed = text.trim();
  if (trimmed === CHECKIN_PHRASE) return { text: null };
  if (trimmed === CHECKIN_PREFIX) return { text: null };
  if (trimmed.startsWith(`${CHECKIN_PREFIX} `)) {
    const rest = trimmed.slice(CHECKIN_PREFIX.length).trim();
    return { text: rest.length > 0 ? rest : null };
  }
  return null;
}

export function parseFeedback(text: string): string | null {
  const trimmed = text.trim();
  return FEEDBACK_PHRASES.has(trimmed) ? trimmed : null;
}
