import { MeetupPhase } from "@prisma/client";

/**
 * 小聚活動狀態機（純邏輯、無 I/O）。
 *
 *   SETUP → READY → OPENING → CHECKIN → ICEBREAKER → INTERACTION → FREE_TALK → CLOSING → ENDED
 *
 * PAUSED 是暫停狀態，暫停前的階段存在 pausedFromPhase，恢復後回到原本階段。
 * CANCELLED 是終止狀態（跟 ENDED 分開記錄，方便未來統計「正常結束」vs「取消」）。
 */

/** 活動正式開始後、可以被「下一步/跳過」推進的階段，順序即流程順序 */
const FLOW: MeetupPhase[] = [
  MeetupPhase.OPENING,
  MeetupPhase.CHECKIN,
  MeetupPhase.ICEBREAKER,
  MeetupPhase.INTERACTION,
  MeetupPhase.FREE_TALK,
  MeetupPhase.CLOSING,
];

const PHASE_LABELS: Record<MeetupPhase, string> = {
  SETUP: "設定中",
  READY: "準備開始",
  OPENING: "開場",
  CHECKIN: "簽到",
  ICEBREAKER: "破冰問題",
  INTERACTION: "互動環節",
  FREE_TALK: "自由交流",
  CLOSING: "尾聲",
  ENDED: "已結束",
  PAUSED: "已暫停",
  CANCELLED: "已取消",
};

export function phaseLabel(phase: MeetupPhase): string {
  return PHASE_LABELS[phase];
}

/** 這個階段是不是「活動正式開始後、可以推進」的階段（不含 PAUSED/SETUP/READY/ENDED/CANCELLED） */
export function isProgressable(phase: MeetupPhase): boolean {
  return FLOW.includes(phase);
}

/**
 * 依流程順序算出「下一步」要去的階段。
 * CLOSING 的下一步是 ENDED（活動流程跑完）。
 * 傳入不可推進的階段回傳 null，呼叫端要自行擋下。
 */
export function nextPhaseAfter(phase: MeetupPhase): MeetupPhase | null {
  const idx = FLOW.indexOf(phase);
  if (idx === -1) return null;
  if (idx === FLOW.length - 1) return MeetupPhase.ENDED;
  return FLOW[idx + 1];
}

/** 可以暫停的階段：活動已經開始、還沒結束/取消/暫停 */
export function canPause(phase: MeetupPhase): boolean {
  return FLOW.includes(phase);
}

/** 可以更換題目的階段：只有破冰、互動兩個階段有「題目」這個概念 */
export function canChangeQuestion(phase: MeetupPhase): boolean {
  return phase === MeetupPhase.ICEBREAKER || phase === MeetupPhase.INTERACTION;
}

/** 活動是否已經走到終點（不能再被任何指令操作，除了查詢） */
export function isTerminal(phase: MeetupPhase): boolean {
  return phase === MeetupPhase.ENDED || phase === MeetupPhase.CANCELLED;
}
