/**
 * 生成文案的守門員：長度、黑名單、個資樣式。
 * 回傳整理後的文字；不通過回 null（呼叫端負責 fallback）。
 */

const MAX_LENGTH = 200;

const BLACKLIST_PATTERNS: RegExp[] = [
  // 政治敏感（人設規則已禁止，這裡是最後防線）
  /政治|選舉|總統|政黨/,
  // 粗俗字眼
  /幹你|靠北|媽的|智障|白癡|去死/,
  // 看起來像電話號碼
  /09\d{8}|\d{4}-\d{6}|\d{2,4}-\d{7,8}/,
  // 看起來像身分證字號
  /[A-Z][12]\d{8}/,
  // 網址（避免被 prompt injection 帶去外部連結）
  /https?:\/\//i,
];

export function moderateCopy(raw: string): string | null {
  let text = raw.trim();

  // 去掉模型偶爾自作主張加的引號包裝
  text = text.replace(/^["「『]+/, "").replace(/["」』]+$/, "").trim();

  if (text.length === 0) return null;
  if (text.length > MAX_LENGTH) return null;

  for (const pattern of BLACKLIST_PATTERNS) {
    if (pattern.test(text)) return null;
  }

  return text;
}
