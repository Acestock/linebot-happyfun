/**
 * 小聚統計的純邏輯（無 I/O）— 未簽到名單、發言熱度排行。
 * manager.ts 負責從資料庫撈資料，這裡只做資料整理。
 */

export interface MemberLike {
  id: string;
  displayName: string | null;
}

export interface MissingCheckins {
  /** 最多列出這麼多人名，超過的用 totalMissing 顯示「等共 N 位」 */
  names: string[];
  totalMissing: number;
}

/**
 * 「未簽到名單」是曾在這個群組活躍過的成員（GroupMember，非 LINE 官方成員清單——
 * LINE 平台本來就不提供完整群組成員清單）扣掉已經簽到的人。
 */
export function computeMissingCheckins(
  activeMembers: MemberLike[],
  checkedInMemberIds: string[],
  limit = 15,
): MissingCheckins {
  const checkedIn = new Set(checkedInMemberIds);
  const missing = activeMembers.filter((m) => !checkedIn.has(m.id));
  return {
    names: missing.slice(0, limit).map((m) => m.displayName ?? "神祕成員"),
    totalMissing: missing.length,
  };
}

export function computeTotalMessages(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

/** 找出發言最多的成員（回傳 memberId，名字由呼叫端查 DB 解析） */
export function computeTopEntry(counts: Record<string, number>): { memberId: string; count: number } | null {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  const [memberId, count] = entries.reduce((max, cur) => (cur[1] > max[1] ? cur : max));
  return { memberId, count };
}

/** 把一則訊息計入發言統計；純函式，回傳新的 counts 物件（不修改原物件） */
export function incrementMessageCount(
  counts: Record<string, number>,
  memberId: string,
): Record<string, number> {
  return { ...counts, [memberId]: (counts[memberId] ?? 0) + 1 };
}
