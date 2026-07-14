import { MeetupPhase } from "@prisma/client";
import { phaseLabel } from "./stateMachine";
import {
  ICEBREAKER_CATEGORY_LABELS,
  INTERACTION_TYPE_LABELS,
  type IcebreakerCategory,
  type InteractionType,
} from "./questionBanks";
import type { SetupStep } from "./setupWizard";
import { STYLE_OPTIONS, TIME_OPTIONS } from "./setupWizard";

/**
 * 所有面向使用者的文字模板 — 純函式，不接 AI、不做流程判斷，只負責「把資料排版成文字」。
 */

export const PERMISSION_DENIED_TEXT = "這個操作只有本場活動的主辦人可以使用。";
export const ALREADY_ACTIVE_TEXT =
  "這個群組目前已有一場尚未結束的小聚，請先結束或取消原本的活動。";
export const NO_ACTIVE_MEETUP_TEXT = "目前沒有進行中的小聚喔，輸入「建立小聚」開始一場新的！";

export function buildSetupQuestionText(step: SetupStep): string {
  switch (step) {
    case "name":
      return "來建立一場新的小聚吧！\n\n請問這場小聚要叫什麼名字？";
    case "time":
      return `預計要進行多久呢？（可選：${TIME_OPTIONS.join(" / ")}）`;
    case "custom_time":
      return "請輸入預計進行的分鐘數（例如 45）：";
    case "style":
      return `這場小聚想用什麼主持風格？（可選：${STYLE_OPTIONS.join(" / ")}）`;
    case "icebreaker":
      return `想用哪一種破冰題？（可選：${Object.values(ICEBREAKER_CATEGORY_LABELS).join(" / ")}）`;
    case "custom_icebreaker_text":
      return "請直接輸入你想用的破冰問題文字：";
    case "interaction":
      return `想安排哪一種互動環節？（可選：${Object.values(INTERACTION_TYPE_LABELS).join(" / ")}）`;
  }
}

export function buildInvalidAnswerText(step: SetupStep): string {
  return `這個答案我看不太懂，${buildSetupQuestionText(step)}`;
}

export function buildCreationConfirmation(params: {
  name: string;
  hostDisplayName: string;
  plannedMinutes: number;
  hostStyle: string;
  icebreakerCategory: IcebreakerCategory;
  interactionType: InteractionType;
}): string {
  return (
    `小聚活動已建立\n\n` +
    `活動名稱：${params.name}\n` +
    `主辦人：${params.hostDisplayName}\n` +
    `預計時間：${params.plannedMinutes} 分鐘\n` +
    `主持風格：${params.hostStyle}\n` +
    `破冰類型：${ICEBREAKER_CATEGORY_LABELS[params.icebreakerCategory]}\n` +
    `互動環節：${INTERACTION_TYPE_LABELS[params.interactionType]}\n\n` +
    `請由主辦人輸入「開始小聚」開始活動。`
  );
}

export function buildOpeningText(params: { name: string; plannedMinutes: number; interactionType: InteractionType }): string {
  const flowParts = ["簡單簽到", "破冰問題"];
  if (params.interactionType !== "none") flowParts.push("互動環節");
  flowParts.push("自由交流");

  return (
    `大家好，歡迎來到「${params.name}」！\n\n` +
    `今天預計進行約 ${params.plannedMinutes} 分鐘，流程包含${flowParts.join("、")}。\n\n` +
    `不用有壓力，按照自己的步調參加就可以了。\n\n` +
    `（主辦人可以輸入「下一步」推進流程）`
  );
}

export const CHECKIN_PROMPT_TEXT =
  "先用一句話或一個表情符號，分享你現在的心情吧。\n\n" +
  "輸入「簽到 你的心情」或直接說「我到了」都可以簽到唷！";

export function buildIcebreakerText(question: string): string {
  return `💭 破冰問題\n\n${question}\n\n大家可以自然回答，不用等主持人點名～`;
}

export function buildInteractionText(prompt: string): string {
  return `🎲 互動環節\n\n${prompt}`;
}

export const INTERACTION_SKIPPED_NONE_TEXT =
  "這場小聚沒有安排額外互動環節，直接進入自由交流時間～";

export const FREE_TALK_TEXT =
  "接下來是自由交流時間。\n\n" +
  "可以接著聊剛才的答案，也可以分享最近正在做的事情。Bot 暫時不打擾大家，主辦人準備結束時輸入「下一步」即可。";

export function buildClosingSummary(checkinCount: number): string {
  return (
    `今天的小聚差不多告一段落了，謝謝大家參加！\n\n` +
    `本次共有 ${checkinCount} 人完成簽到。\n\n` +
    `離開前別忘了合照，或和今天聊得來的人交換聯絡方式。`
  );
}

export const ENDED_THANKS_TEXT = "本場小聚正式結束，感謝主持與參與！期待下次見面 🎉";
export const CANCELLED_TEXT = "本場小聚已取消。";
export const PAUSED_TEXT = "小聚已暫停，輸入「繼續小聚」隨時可以恢復。";

export function buildResumeText(phase: MeetupPhase): string {
  return `小聚繼續進行～目前回到「${phaseLabel(phase)}」階段。`;
}

export function buildFeedbackAck(): string {
  return "謝謝你的回饋🙏";
}

export function buildStatusText(params: {
  name: string;
  hostDisplayName: string;
  phase: MeetupPhase;
  elapsedMinutes: number;
  plannedMinutes: number | null;
  checkinCount: number;
  currentIcebreaker: string | null;
  interactionType: InteractionType | null;
}): string {
  const lines = [
    `目前小聚狀態\n`,
    `活動：${params.name}`,
    `主辦人：${params.hostDisplayName}`,
    `目前階段：${phaseLabel(params.phase)}`,
    `已進行：${params.elapsedMinutes} 分鐘`,
    `預計時間：${params.plannedMinutes ?? "未設定"} 分鐘`,
    `已簽到：${params.checkinCount} 人`,
  ];
  if (params.currentIcebreaker) {
    lines.push(`目前破冰題：${params.currentIcebreaker}`);
  }
  if (params.interactionType) {
    lines.push(`互動環節：${INTERACTION_TYPE_LABELS[params.interactionType]}`);
  }
  return lines.join("\n");
}

export function buildHelpText(): string {
  return (
    `📖 小聚主持人使用說明\n` +
    `━━━━━━━━━━\n` +
    `建立小聚　建立一場新的小聚活動\n` +
    `開始小聚　主辦人開始活動\n` +
    `下一步　　推進到下一階段\n` +
    `跳過　　　跳過目前階段\n` +
    `換題目　　更換破冰題或互動題\n` +
    `暫停小聚　暫停活動\n` +
    `繼續小聚　從暫停處繼續\n` +
    `小聚狀態　查看目前進度\n` +
    `結束小聚　結束活動\n` +
    `取消小聚　取消活動\n` +
    `━━━━━━━━━━\n` +
    `以上管理指令只有主辦人可以使用，建立活動的人會自動成為主辦人。`
  );
}
