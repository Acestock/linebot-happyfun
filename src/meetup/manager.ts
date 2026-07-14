import { MeetupPhase, type Meetup } from "@prisma/client";
import { prisma } from "../db/prisma";
import {
  canChangeQuestion,
  canPause,
  isProgressable,
  isTerminal,
  nextPhaseAfter,
  phaseLabel,
} from "./stateMachine";
import {
  INTERACTION_TYPE_LABELS,
  pickIcebreaker,
  pickInteractionPrompt,
  type IcebreakerCategory,
  type InteractionType,
} from "./questionBanks";
import {
  FIRST_SETUP_STEP,
  nextSetupStep,
  parseCustomMinutes,
  parseIcebreakerOption,
  parseInteractionOption,
  parseStyleOption,
  parseTimeOption,
  type SetupStep,
} from "./setupWizard";
import {
  ALREADY_ACTIVE_TEXT,
  CANCELLED_TEXT,
  CHECKIN_PROMPT_TEXT,
  ENDED_THANKS_TEXT,
  FREE_TALK_TEXT,
  INTERACTION_SKIPPED_NONE_TEXT,
  NO_ACTIVE_MEETUP_TEXT,
  PAUSED_TEXT,
  PERMISSION_DENIED_TEXT,
  buildClosingSummary,
  buildCreationConfirmation,
  buildFeedbackAck,
  buildHelpText,
  buildIcebreakerText,
  buildInteractionText,
  buildInvalidAnswerText,
  buildOpeningText,
  buildResumeText,
  buildSetupQuestionText,
  buildStatusText,
} from "./messages";
import {
  AMBIGUOUS_HOST_COMMANDS,
  isHelpCommand,
  isStatusCommand,
  parseCheckin,
  parseFeedback,
  parseHostCommandFromCode,
  parseHostCommandFromText,
  type HostCommand,
} from "./commands";

export type MeetupUiHint =
  | { type: "none" }
  | { type: "setup_options"; options: string[] }
  | { type: "ready" }
  | { type: "host_controls"; phase: MeetupPhase }
  | { type: "checkin" }
  | { type: "closing" };

/**
 * 「高光時刻」的結構化資料 — 純資料，不含任何 LINE 型別，讓 manager.ts 保持可單元測試。
 * 實際怎麼畫成 Flex 卡片是 src/line/meetupCards.ts 的事。只有這幾個時刻才給卡片，
 * 其餘（設定精靈問答、簽到/回饋確認、暫停/繼續…）維持輕量純文字，問答節奏才不會被拖慢。
 */
export type MeetupCardPayload =
  | {
      kind: "created";
      name: string;
      hostDisplayName: string;
      plannedMinutes: number;
      hostStyle: string;
      icebreakerCategory: IcebreakerCategory;
      interactionType: InteractionType;
    }
  | { kind: "opening"; name: string; plannedMinutes: number; interactionType: InteractionType }
  | { kind: "checkin" }
  | { kind: "icebreaker"; question: string; changed?: boolean }
  | { kind: "interaction"; prompt: string; typeLabel: string; changed?: boolean }
  | { kind: "closing"; checkinCount: number }
  | {
      kind: "status";
      name: string;
      hostDisplayName: string;
      phase: MeetupPhase;
      pausedFromPhase: MeetupPhase | null;
      elapsedMinutes: number;
      plannedMinutes: number | null;
      checkinCount: number;
      currentIcebreaker: string | null;
      interactionType: InteractionType | null;
    };

export interface MeetupReply {
  /** 純文字版本：沒有卡片時直接發送；有卡片時當 Flex 的 altText */
  text: string;
  ui: MeetupUiHint;
  card?: MeetupCardPayload;
}

interface MemberIdentity {
  id: string;
  displayName: string | null;
}

const none = (): MeetupUiHint => ({ type: "none" });

function isHost(meetup: Meetup, member: MemberIdentity): boolean {
  // 權限驗證用 GroupMember.id（其唯一性來自 LINE lineUserId），絕不比對顯示名稱。
  return meetup.hostMemberId === member.id;
}

async function getActiveMeetup(groupId: string): Promise<Meetup | null> {
  return prisma.meetup.findFirst({
    where: { groupId, phase: { notIn: [MeetupPhase.ENDED, MeetupPhase.CANCELLED] } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 小聚進行中時，party 選單／遊戲功能要整個暫停——不然懸浮按鈕、party 選單會跟
 * 主持人的操作面板混在一起。給 webhook 在 fallback 到遊戲系統之前先檢查。
 */
export async function hasActiveMeetup(groupId: string): Promise<boolean> {
  return (await getActiveMeetup(groupId)) !== null;
}

async function getHostDisplayName(meetup: Meetup): Promise<string> {
  const host = await prisma.groupMember.findUnique({ where: { id: meetup.hostMemberId } });
  return host?.displayName ?? "主辦人";
}

async function getCheckinCount(meetupId: string): Promise<number> {
  return prisma.meetupCheckin.count({ where: { meetupId } });
}

// ---------------------------------------------------------------------------
// 建立活動 + 設定精靈
// ---------------------------------------------------------------------------

async function createMeetup(groupId: string, host: MemberIdentity): Promise<MeetupReply> {
  const existing = await getActiveMeetup(groupId);
  if (existing) return { text: ALREADY_ACTIVE_TEXT, ui: none() };

  await prisma.meetup.create({
    data: { groupId, hostMemberId: host.id, phase: MeetupPhase.SETUP, setupStep: FIRST_SETUP_STEP },
  });

  return { text: buildSetupQuestionText(FIRST_SETUP_STEP), ui: setupUi(FIRST_SETUP_STEP) };
}

function setupUi(step: SetupStep): MeetupUiHint {
  switch (step) {
    case "time":
      return { type: "setup_options", options: ["30 分鐘", "60 分鐘", "90 分鐘", "自訂"] };
    case "style":
      return { type: "setup_options", options: ["輕鬆", "活潑", "溫和", "正式"] };
    case "icebreaker":
      return { type: "setup_options", options: ["輕鬆日常", "興趣交流", "工作交流", "隨機題目", "主辦人自訂"] };
    case "interaction":
      return {
        type: "setup_options",
        options: ["快問快答", "二選一", "主題分享", "接龍", "隨機互動", "不安排互動環節"],
      };
    case "name":
    case "custom_time":
    case "custom_icebreaker_text":
      return none();
  }
}

async function handleSetupAnswer(meetup: Meetup, text: string): Promise<MeetupReply> {
  const step = meetup.setupStep as SetupStep;

  switch (step) {
    case "name": {
      const name = text.trim().slice(0, 60);
      if (name.length === 0) return { text: buildInvalidAnswerText(step), ui: setupUi(step) };
      return advanceSetup(meetup, step, { name }, {});
    }
    case "time": {
      const parsed = parseTimeOption(text);
      if (parsed === null) return { text: buildInvalidAnswerText(step), ui: setupUi(step) };
      if (parsed === "custom") {
        await prisma.meetup.update({ where: { id: meetup.id }, data: { setupStep: "custom_time" } });
        return { text: buildSetupQuestionText("custom_time"), ui: setupUi("custom_time") };
      }
      return advanceSetup(meetup, step, { plannedMinutes: parsed }, {});
    }
    case "custom_time": {
      const minutes = parseCustomMinutes(text);
      if (minutes === null) return { text: buildInvalidAnswerText(step), ui: setupUi(step) };
      return advanceSetup(meetup, "time", { plannedMinutes: minutes }, {});
    }
    case "style": {
      const style = parseStyleOption(text);
      if (style === null) return { text: buildInvalidAnswerText(step), ui: setupUi(step) };
      return advanceSetup(meetup, step, { hostStyle: style }, {});
    }
    case "icebreaker": {
      const category = parseIcebreakerOption(text);
      if (category === null) return { text: buildInvalidAnswerText(step), ui: setupUi(step) };
      return advanceSetup(meetup, step, { icebreakerCategory: category }, { icebreakerCategory: category });
    }
    case "custom_icebreaker_text": {
      const custom = text.trim().slice(0, 200);
      if (custom.length === 0) return { text: buildInvalidAnswerText(step), ui: setupUi(step) };
      return advanceSetup(meetup, step, { customIcebreakerText: custom }, {});
    }
    case "interaction": {
      const type = parseInteractionOption(text);
      if (type === null) return { text: buildInvalidAnswerText(step), ui: setupUi(step) };
      return finishSetup(meetup, { interactionType: type });
    }
  }
}

/** 存下這一題答案，決定精靈下一步要問什麼（或收尾） */
async function advanceSetup(
  meetup: Meetup,
  currentStep: SetupStep,
  data: Record<string, unknown>,
  stepContext: { icebreakerCategory?: IcebreakerCategory },
): Promise<MeetupReply> {
  const next = nextSetupStep(currentStep, stepContext);
  if (next === null) {
    return finishSetup(meetup, data);
  }
  await prisma.meetup.update({ where: { id: meetup.id }, data: { ...data, setupStep: next } });
  return { text: buildSetupQuestionText(next), ui: setupUi(next) };
}

async function finishSetup(meetup: Meetup, lastStepData: Record<string, unknown>): Promise<MeetupReply> {
  const updated = await prisma.meetup.update({
    where: { id: meetup.id },
    data: { ...lastStepData, setupStep: null, phase: MeetupPhase.READY },
  });
  const hostDisplayName = await getHostDisplayName(updated);
  const plannedMinutes = updated.plannedMinutes ?? 60;
  const hostStyle = updated.hostStyle ?? "輕鬆";
  const icebreakerCategory = (updated.icebreakerCategory as IcebreakerCategory) ?? "random";
  const interactionType = (updated.interactionType as InteractionType) ?? "none";
  const name = updated.name ?? "（未命名小聚）";

  const text = buildCreationConfirmation({
    name,
    hostDisplayName,
    plannedMinutes,
    hostStyle,
    icebreakerCategory,
    interactionType,
  });
  return {
    text,
    ui: { type: "ready" },
    card: { kind: "created", name, hostDisplayName, plannedMinutes, hostStyle, icebreakerCategory, interactionType },
  };
}

// ---------------------------------------------------------------------------
// 主辦人操作
// ---------------------------------------------------------------------------

async function startMeetup(meetup: Meetup): Promise<MeetupReply> {
  if (meetup.phase !== MeetupPhase.READY) {
    return { text: `小聚目前是「${phaseLabel(meetup.phase)}」階段，還不能開始喔。`, ui: none() };
  }
  const updated = await prisma.meetup.update({
    where: { id: meetup.id },
    data: { phase: MeetupPhase.OPENING, startedAt: new Date() },
  });
  const name = updated.name ?? "小聚";
  const plannedMinutes = updated.plannedMinutes ?? 60;
  const interactionType = (updated.interactionType as InteractionType) ?? "none";
  const text = buildOpeningText({ name, plannedMinutes, interactionType });
  return {
    text,
    ui: { type: "host_controls", phase: MeetupPhase.OPENING },
    card: { kind: "opening", name, plannedMinutes, interactionType },
  };
}

async function enterPhase(
  meetup: Meetup,
  phase: MeetupPhase,
): Promise<{ meetup: Meetup; text: string; card?: MeetupCardPayload }> {
  switch (phase) {
    case MeetupPhase.CHECKIN: {
      const updated = await prisma.meetup.update({ where: { id: meetup.id }, data: { phase } });
      return { meetup: updated, text: CHECKIN_PROMPT_TEXT, card: { kind: "checkin" } };
    }
    case MeetupPhase.ICEBREAKER: {
      const category = (meetup.icebreakerCategory as IcebreakerCategory) ?? "random";
      const used = Array.isArray(meetup.usedIcebreakers) ? (meetup.usedIcebreakers as string[]) : [];
      const question = pickIcebreaker(category, used, meetup.customIcebreakerText) ?? "分享一件最近讓你印象深刻的小事？";
      const updated = await prisma.meetup.update({
        where: { id: meetup.id },
        data: { phase, currentIcebreaker: question, usedIcebreakers: [...used, question] },
      });
      return {
        meetup: updated,
        text: buildIcebreakerText(question),
        card: { kind: "icebreaker", question },
      };
    }
    case MeetupPhase.INTERACTION: {
      const type = (meetup.interactionType as InteractionType) ?? "none";
      if (type === "none") {
        // 沒安排互動環節，直接視為進入自由交流
        const updated = await prisma.meetup.update({
          where: { id: meetup.id },
          data: { phase: MeetupPhase.FREE_TALK },
        });
        return { meetup: updated, text: `${INTERACTION_SKIPPED_NONE_TEXT}\n\n${FREE_TALK_TEXT}` };
      }
      const used = Array.isArray(meetup.usedInteractions) ? (meetup.usedInteractions as string[]) : [];
      const drawn = pickInteractionPrompt(type, used);
      const prompt = drawn?.prompt ?? "分享一件最近覺得有趣的小事吧！";
      const resolvedType = drawn?.resolvedType ?? type;
      const updated = await prisma.meetup.update({
        where: { id: meetup.id },
        data: { phase, currentInteraction: prompt, usedInteractions: [...used, prompt] },
      });
      return {
        meetup: updated,
        text: buildInteractionText(prompt),
        card: { kind: "interaction", prompt, typeLabel: INTERACTION_TYPE_LABELS[resolvedType] },
      };
    }
    case MeetupPhase.FREE_TALK: {
      const updated = await prisma.meetup.update({ where: { id: meetup.id }, data: { phase } });
      return { meetup: updated, text: FREE_TALK_TEXT };
    }
    case MeetupPhase.CLOSING: {
      const checkinCount = await getCheckinCount(meetup.id);
      const updated = await prisma.meetup.update({ where: { id: meetup.id }, data: { phase } });
      return {
        meetup: updated,
        text: buildClosingSummary(checkinCount),
        card: { kind: "closing", checkinCount },
      };
    }
    case MeetupPhase.ENDED: {
      const updated = await prisma.meetup.update({
        where: { id: meetup.id },
        data: { phase, endedAt: new Date() },
      });
      return { meetup: updated, text: ENDED_THANKS_TEXT };
    }
    default:
      throw new Error(`enterPhase: unsupported target phase ${phase}`);
  }
}

async function advancePhase(meetup: Meetup, mode: "next" | "skip"): Promise<MeetupReply> {
  if (!isProgressable(meetup.phase)) {
    return { text: `小聚目前是「${phaseLabel(meetup.phase)}」階段，沒有下一步可以走。`, ui: none() };
  }
  const target = nextPhaseAfter(meetup.phase);
  if (target === null) return { text: "目前已經是最後階段了。", ui: none() };

  const { meetup: updated, text, card } = await enterPhase(meetup, target);
  const prefix = mode === "skip" ? "⏭️ 已跳過本階段。\n\n" : "";

  if (updated.phase === MeetupPhase.ENDED) {
    return { text: `${prefix}${text}`, ui: none() };
  }
  if (updated.phase === MeetupPhase.CLOSING) {
    return { text: `${prefix}${text}`, ui: { type: "closing" }, card };
  }
  if (updated.phase === MeetupPhase.CHECKIN) {
    return { text: `${prefix}${text}`, ui: { type: "checkin" }, card };
  }
  return { text: `${prefix}${text}`, ui: { type: "host_controls", phase: updated.phase }, card };
}

async function changeQuestion(meetup: Meetup): Promise<MeetupReply> {
  if (!canChangeQuestion(meetup.phase)) {
    return { text: "目前階段沒有題目可以更換喔。", ui: { type: "host_controls", phase: meetup.phase } };
  }

  if (meetup.phase === MeetupPhase.ICEBREAKER) {
    if (meetup.icebreakerCategory === "custom") {
      return {
        text: "自訂破冰題只有主辦人設定的那一題，沒有其他題目可以更換囉！",
        ui: { type: "host_controls", phase: meetup.phase },
      };
    }
    const category = (meetup.icebreakerCategory as IcebreakerCategory) ?? "random";
    const used = Array.isArray(meetup.usedIcebreakers) ? (meetup.usedIcebreakers as string[]) : [];
    const question = pickIcebreaker(category, used) ?? "分享一件最近讓你印象深刻的小事？";
    await prisma.meetup.update({
      where: { id: meetup.id },
      data: { currentIcebreaker: question, usedIcebreakers: [...used, question] },
    });
    return {
      text: `🔄 換題目！\n\n${buildIcebreakerText(question)}`,
      ui: { type: "host_controls", phase: meetup.phase },
      card: { kind: "icebreaker", question, changed: true },
    };
  }

  // INTERACTION
  const type = (meetup.interactionType as InteractionType) ?? "none";
  if (type === "chain") {
    return {
      text: "接龍的規則就只有一種玩法，沒有其他題目可以更換囉！",
      ui: { type: "host_controls", phase: meetup.phase },
    };
  }
  const used = Array.isArray(meetup.usedInteractions) ? (meetup.usedInteractions as string[]) : [];
  const drawn = pickInteractionPrompt(type, used);
  const prompt = drawn?.prompt ?? "分享一件最近覺得有趣的小事吧！";
  const resolvedType = drawn?.resolvedType ?? type;
  await prisma.meetup.update({
    where: { id: meetup.id },
    data: { currentInteraction: prompt, usedInteractions: [...used, prompt] },
  });
  return {
    text: `🔄 換題目！\n\n${buildInteractionText(prompt)}`,
    ui: { type: "host_controls", phase: meetup.phase },
    card: { kind: "interaction", prompt, typeLabel: INTERACTION_TYPE_LABELS[resolvedType], changed: true },
  };
}

async function pauseMeetup(meetup: Meetup): Promise<MeetupReply> {
  if (!canPause(meetup.phase)) {
    return { text: "現在這個階段沒辦法暫停喔。", ui: none() };
  }
  await prisma.meetup.update({
    where: { id: meetup.id },
    data: { phase: MeetupPhase.PAUSED, pausedFromPhase: meetup.phase },
  });
  return { text: PAUSED_TEXT, ui: { type: "host_controls", phase: MeetupPhase.PAUSED } };
}

async function resumeMeetup(meetup: Meetup): Promise<MeetupReply> {
  if (meetup.phase !== MeetupPhase.PAUSED || !meetup.pausedFromPhase) {
    return { text: "小聚目前沒有在暫停中喔。", ui: none() };
  }
  const restored = meetup.pausedFromPhase;
  await prisma.meetup.update({
    where: { id: meetup.id },
    data: { phase: restored, pausedFromPhase: null },
  });
  return { text: buildResumeText(restored), ui: { type: "host_controls", phase: restored } };
}

async function endMeetup(meetup: Meetup): Promise<MeetupReply> {
  if (isTerminal(meetup.phase)) {
    return { text: "小聚已經結束囉。", ui: none() };
  }
  if (meetup.phase === MeetupPhase.CLOSING) {
    await prisma.meetup.update({
      where: { id: meetup.id },
      data: { phase: MeetupPhase.ENDED, endedAt: new Date() },
    });
    return { text: ENDED_THANKS_TEXT, ui: none() };
  }
  const checkinCount = await getCheckinCount(meetup.id);
  await prisma.meetup.update({
    where: { id: meetup.id },
    data: { phase: MeetupPhase.ENDED, endedAt: new Date() },
  });
  return { text: buildClosingSummary(checkinCount), ui: none() };
}

async function cancelMeetup(meetup: Meetup): Promise<MeetupReply> {
  if (isTerminal(meetup.phase)) {
    return { text: "小聚已經結束或取消囉。", ui: none() };
  }
  await prisma.meetup.update({
    where: { id: meetup.id },
    data: { phase: MeetupPhase.CANCELLED, endedAt: new Date() },
  });
  return { text: CANCELLED_TEXT, ui: none() };
}

async function executeHostCommand(
  meetup: Meetup,
  member: MemberIdentity,
  cmd: HostCommand,
): Promise<MeetupReply> {
  if (!isHost(meetup, member)) {
    return { text: PERMISSION_DENIED_TEXT, ui: none() };
  }
  switch (cmd) {
    case "start":
      return startMeetup(meetup);
    case "next":
      return advancePhase(meetup, "next");
    case "skip":
      return advancePhase(meetup, "skip");
    case "change_question":
      return changeQuestion(meetup);
    case "pause":
      return pauseMeetup(meetup);
    case "resume":
      return resumeMeetup(meetup);
    case "end":
      return endMeetup(meetup);
    case "cancel":
      return cancelMeetup(meetup);
    case "create":
      // create 不需要既有活動、也不用權限檢查，走另一條路徑，不會進到這裡
      throw new Error("unreachable: create is handled before executeHostCommand");
  }
}

// ---------------------------------------------------------------------------
// 簽到 / 回饋
// ---------------------------------------------------------------------------

/**
 * 記錄簽到。刻意不回覆——簽到跟破冰題一樣，讓大家自然發言就好，
 * 機器人不用逐一回應每一個人，主辦人自己判斷人到齊了沒、按下一步繼續。
 */
async function recordCheckin(
  meetup: Meetup,
  member: MemberIdentity,
  text: string | null,
): Promise<MeetupReply | null> {
  if (meetup.phase !== MeetupPhase.CHECKIN) {
    return { text: "現在不是簽到時間喔。", ui: none() };
  }
  await prisma.meetupCheckin.upsert({
    where: { meetupId_memberId: { meetupId: meetup.id, memberId: member.id } },
    create: { meetupId: meetup.id, memberId: member.id, text },
    update: { text },
  });
  return null;
}

async function recordFeedback(meetup: Meetup, member: MemberIdentity, feedback: string): Promise<MeetupReply> {
  await prisma.meetupFeedback.upsert({
    where: { meetupId_memberId: { meetupId: meetup.id, memberId: member.id } },
    create: { meetupId: meetup.id, memberId: member.id, feedback },
    update: { feedback },
  });
  return { text: buildFeedbackAck(), ui: none() };
}

// ---------------------------------------------------------------------------
// 狀態查詢
// ---------------------------------------------------------------------------

async function buildStatus(meetup: Meetup): Promise<MeetupReply> {
  const [hostDisplayName, checkinCount] = await Promise.all([
    getHostDisplayName(meetup),
    getCheckinCount(meetup.id),
  ]);
  const elapsedMinutes = meetup.startedAt
    ? Math.max(0, Math.round((Date.now() - meetup.startedAt.getTime()) / 60000))
    : 0;

  const name = meetup.name ?? "（未命名小聚）";
  const interactionType = (meetup.interactionType as InteractionType) ?? null;

  const text = buildStatusText({
    name,
    hostDisplayName,
    phase: meetup.phase,
    elapsedMinutes,
    plannedMinutes: meetup.plannedMinutes,
    checkinCount,
    currentIcebreaker: meetup.currentIcebreaker,
    interactionType,
  });
  return {
    text,
    ui: none(),
    card: {
      kind: "status",
      name,
      hostDisplayName,
      phase: meetup.phase,
      pausedFromPhase: meetup.pausedFromPhase,
      elapsedMinutes,
      plannedMinutes: meetup.plannedMinutes,
      checkinCount,
      currentIcebreaker: meetup.currentIcebreaker,
      interactionType,
    },
  };
}

// ---------------------------------------------------------------------------
// Webhook 進入點
// ---------------------------------------------------------------------------

/** 文字訊息路由。回傳 null 代表跟小聚無關，呼叫端可以繼續走原本的邏輯（例如遊戲）。 */
export async function handleMeetupText(
  groupId: string,
  member: MemberIdentity,
  rawText: string,
): Promise<MeetupReply | null> {
  const text = rawText.trim();
  if (text.length === 0) return null;

  if (isHelpCommand(text)) {
    return { text: buildHelpText(), ui: none() };
  }

  if (isStatusCommand(text)) {
    const meetup = await getActiveMeetup(groupId);
    if (!meetup) return { text: NO_ACTIVE_MEETUP_TEXT, ui: none() };
    return buildStatus(meetup);
  }

  const hostCommand = parseHostCommandFromText(text);
  if (hostCommand) {
    if (hostCommand === "create") {
      return createMeetup(groupId, member);
    }
    const meetup = await getActiveMeetup(groupId);
    if (!meetup) {
      // 「下一步」「跳過」這類短詞跟其他系統（例如問答遊戲的跳題）撞詞風險高，
      // 沒有進行中的小聚時靜默放行，不要主動提示；其餘指令詞夠獨特，維持提示。
      if (AMBIGUOUS_HOST_COMMANDS.has(hostCommand)) return null;
      return { text: NO_ACTIVE_MEETUP_TEXT, ui: none() };
    }
    return executeHostCommand(meetup, member, hostCommand);
  }

  const checkin = parseCheckin(text);
  if (checkin) {
    const meetup = await getActiveMeetup(groupId);
    if (!meetup) return null; // 沒有活動時，「簽到」「我到了」這種字句不要打擾群組
    if (meetup.phase !== MeetupPhase.CHECKIN && checkin.explicit) {
      return { text: "現在不是簽到時間喔。", ui: none() };
    }
    if (meetup.phase !== MeetupPhase.CHECKIN) return null; // 非簽到指令、非簽到階段：靜默
    return recordCheckin(meetup, member, checkin.text);
  }

  const feedback = parseFeedback(text);
  if (feedback) {
    const meetup = await getActiveMeetup(groupId);
    const phase = meetup?.phase;
    if (!meetup || (phase !== MeetupPhase.CLOSING && phase !== MeetupPhase.ENDED)) return null;
    return recordFeedback(meetup, member, feedback);
  }

  // SETUP 精靈：只有建立活動的主辦人回答才算數
  const meetup = await getActiveMeetup(groupId);
  if (meetup && meetup.phase === MeetupPhase.SETUP && meetup.hostMemberId === member.id) {
    return handleSetupAnswer(meetup, text);
  }

  return null;
}

/** postback 觸發的主持人操作按鈕 */
export async function handleMeetupPostback(
  groupId: string,
  member: MemberIdentity,
  code: string,
): Promise<MeetupReply | null> {
  const cmd = parseHostCommandFromCode(code);
  if (!cmd) return null;

  const meetup = await getActiveMeetup(groupId);
  if (!meetup) return { text: NO_ACTIVE_MEETUP_TEXT, ui: none() };
  return executeHostCommand(meetup, member, cmd);
}
