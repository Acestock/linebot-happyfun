import { MeetupPhase } from "@prisma/client";
import { MEETUP_FLOW, phaseLabel } from "./stateMachine";

/**
 * 把主辦人設定的總時間，依權重拆成各階段的預計分鐘數（純邏輯、無 I/O）。
 * 用途有二：1) 建立小聚後的確認訊息秀出完整流程時間表 2) 排程用它算「這階段還剩多少時間」。
 */

// 非 MEETUP_FLOW 的階段（SETUP/READY/ENDED/PAUSED/CANCELLED）不會被拿來算時間預算，
// 權重與圖示補 0/空字串只是為了滿足 Record<MeetupPhase, T> 的完整鍵型別。
const PHASE_WEIGHTS: Record<MeetupPhase, number> = {
  [MeetupPhase.SETUP]: 0,
  [MeetupPhase.READY]: 0,
  [MeetupPhase.OPENING]: 0.05,
  [MeetupPhase.CHECKIN]: 0.1,
  [MeetupPhase.ICEBREAKER]: 0.2,
  [MeetupPhase.INTERACTION]: 0.25,
  [MeetupPhase.FREE_TALK]: 0.3,
  [MeetupPhase.CLOSING]: 0.1,
  [MeetupPhase.ENDED]: 0,
  [MeetupPhase.PAUSED]: 0,
  [MeetupPhase.CANCELLED]: 0,
};

export const PHASE_EMOJI: Record<MeetupPhase, string> = {
  [MeetupPhase.SETUP]: "",
  [MeetupPhase.READY]: "",
  [MeetupPhase.OPENING]: "🎤",
  [MeetupPhase.CHECKIN]: "🙋",
  [MeetupPhase.ICEBREAKER]: "💭",
  [MeetupPhase.INTERACTION]: "🎲",
  [MeetupPhase.FREE_TALK]: "💬",
  [MeetupPhase.CLOSING]: "🎊",
  [MeetupPhase.ENDED]: "",
  [MeetupPhase.PAUSED]: "",
  [MeetupPhase.CANCELLED]: "",
};

/**
 * 用最大餘數法分配，確保總和精準等於 plannedMinutes（不會因為四捨五入兜不起來）。
 * 總時間很短（例如 5 分鐘）時，權重小的階段分配到 0 分鐘是可接受的邊界情況。
 */
export function computePhaseBudgets(plannedMinutes: number): Record<(typeof MEETUP_FLOW)[number], number> {
  const raw = MEETUP_FLOW.map((phase) => ({ phase, exact: plannedMinutes * PHASE_WEIGHTS[phase] }));
  const base = raw.map(({ phase, exact }) => ({ phase, floor: Math.floor(exact), remainder: exact - Math.floor(exact) }));

  let remaining = plannedMinutes - base.reduce((sum, b) => sum + b.floor, 0);
  const sortedByRemainder = [...base].sort((a, b) => b.remainder - a.remainder);

  const result = {} as Record<(typeof MEETUP_FLOW)[number], number>;
  for (const b of base) result[b.phase] = b.floor;
  for (const b of sortedByRemainder) {
    if (remaining <= 0) break;
    result[b.phase] += 1;
    remaining -= 1;
  }
  return result;
}

export function buildScheduleLines(plannedMinutes: number): string[] {
  const budgets = computePhaseBudgets(plannedMinutes);
  return MEETUP_FLOW.map((phase) => `${PHASE_EMOJI[phase]} ${phaseLabel(phase)}：${budgets[phase]} 分鐘`);
}
