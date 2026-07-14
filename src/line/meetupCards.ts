import { MeetupPhase } from "@prisma/client";
import type { messagingApi } from "@line/bot-sdk";
import type { MeetupCardPayload } from "../meetup/manager";
import { MEETUP_FLOW, phaseLabel } from "../meetup/stateMachine";
import { ICEBREAKER_CATEGORY_LABELS, INTERACTION_TYPE_LABELS } from "../meetup/questionBanks";

/**
 * 小聚活動的「高光時刻」Flex 卡片 — 獨立於 party/遊戲選單的色系，
 * 讓這個進階功能有自己的品牌識別度。純呈現層，不含任何業務邏輯。
 */

const COLOR = {
  teal: "#0F9D8E",
  tealLight: "#E6F7F5",
  sky: "#0EA5E9",
  skyLight: "#E5F5FD",
  amber: "#F59E0B",
  amberLight: "#FEF3E2",
  rose: "#EC4899",
  roseLight: "#FDF0F7",
} as const;

type FlexBox = Record<string, unknown>;

function headerBox(color: string, title: string, subtitle?: string): FlexBox {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: color,
    paddingAll: "16px",
    contents: [
      { type: "text", text: title, weight: "bold", size: "lg", color: "#FFFFFF", wrap: true },
      ...(subtitle
        ? [{ type: "text", text: subtitle, size: "xs", color: "#FFFFFF", margin: "sm", wrap: true }]
        : []),
    ],
  };
}

function detailRow(label: string, value: string): FlexBox {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 2 },
      { type: "text", text: value, size: "sm", color: "#333333", flex: 3, wrap: true },
    ],
  };
}

function postbackButton(
  label: string,
  cmd: string,
  displayText: string,
  style: "primary" | "secondary" = "primary",
  color?: string,
): FlexBox {
  return {
    type: "button",
    style,
    height: "sm",
    ...(color ? { color } : {}),
    action: { type: "postback", label, data: `action=meetup&cmd=${cmd}`, displayText },
  };
}

function messageButton(label: string, text: string, style: "primary" | "secondary" = "secondary"): FlexBox {
  return {
    type: "button",
    style,
    height: "sm",
    action: { type: "message", label, text },
  };
}

function bubble(header: FlexBox, body: FlexBox, footer?: FlexBox): FlexBox {
  return {
    type: "bubble",
    size: "mega",
    header,
    body,
    ...(footer ? { footer } : {}),
  };
}

function bodyBox(contents: FlexBox[], spacing: "sm" | "md" = "md"): FlexBox {
  return { type: "box", layout: "vertical", spacing, paddingAll: "16px", contents };
}

function footerBox(contents: FlexBox[]): FlexBox {
  return { type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px", contents };
}

function buildCreatedCard(p: Extract<MeetupCardPayload, { kind: "created" }>): FlexBox {
  return bubble(
    headerBox(COLOR.teal, "🎉 小聚活動已建立", p.name),
    bodyBox([
      detailRow("主辦人", p.hostDisplayName),
      detailRow("預計時間", `${p.plannedMinutes} 分鐘`),
      detailRow("主持風格", p.hostStyle),
      detailRow("破冰類型", ICEBREAKER_CATEGORY_LABELS[p.icebreakerCategory]),
      detailRow("互動環節", INTERACTION_TYPE_LABELS[p.interactionType]),
      { type: "text", text: "主辦人可以點下方按鈕，或輸入「開始小聚」開始活動", size: "xxs", color: "#999999", margin: "md", wrap: true },
    ]),
    footerBox([postbackButton("▶️ 開始活動", "start", "開始小聚", "primary", COLOR.teal)]),
  );
}

function buildOpeningCard(p: Extract<MeetupCardPayload, { kind: "opening" }>): FlexBox {
  const steps = ["🙋 簡單簽到", "💭 破冰問題"];
  if (p.interactionType !== "none") steps.push("🎲 互動環節");
  steps.push("💬 自由交流");

  return bubble(
    headerBox(COLOR.teal, `🎉 ${p.name}`, "小聚即將開始"),
    bodyBox([
      { type: "text", text: `今天預計進行約 ${p.plannedMinutes} 分鐘`, size: "sm", color: "#333333", wrap: true },
      { type: "separator", margin: "sm" },
      { type: "text", text: "今日流程", weight: "bold", size: "sm", margin: "md" },
      ...steps.map((s) => ({ type: "text", text: s, size: "sm", color: "#555555" }) as FlexBox),
    ]),
    footerBox([postbackButton("➡️ 下一步", "next", "下一步", "primary", COLOR.teal)]),
  );
}

function buildCheckinCard(): FlexBox {
  return bubble(
    headerBox(COLOR.sky, "🙋 簽到時間"),
    bodyBox([
      {
        type: "text",
        text: "先用一句話或一個表情符號，分享你現在的心情吧。",
        size: "sm",
        color: "#333333",
        wrap: true,
      },
      { type: "text", text: "也可以輸入「簽到 你的心情」附上文字", size: "xxs", color: "#999999", margin: "sm" },
    ]),
    footerBox([messageButton("🙋 我到了", "我到了", "primary")]),
  );
}

function buildIcebreakerCard(p: Extract<MeetupCardPayload, { kind: "icebreaker" }>): FlexBox {
  return bubble(
    headerBox(COLOR.amber, p.changed ? "🔄 換題目！" : "💭 破冰問題"),
    bodyBox([{ type: "text", text: p.question, size: "md", color: "#333333", wrap: true }]),
    footerBox([
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [postbackButton("🔄 換題目", "change", "換題目", "secondary"), postbackButton("➡️ 下一步", "next", "下一步", "primary", COLOR.amber)],
      },
    ]),
  );
}

function buildInteractionCard(p: Extract<MeetupCardPayload, { kind: "interaction" }>): FlexBox {
  return bubble(
    headerBox(COLOR.rose, p.changed ? "🔄 換題目！" : "🎲 互動環節", p.typeLabel),
    bodyBox([{ type: "text", text: p.prompt, size: "md", color: "#333333", wrap: true }]),
    footerBox([
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [postbackButton("🔄 換題目", "change", "換題目", "secondary"), postbackButton("➡️ 下一步", "next", "下一步", "primary", COLOR.rose)],
      },
    ]),
  );
}

function buildClosingCard(p: Extract<MeetupCardPayload, { kind: "closing" }>): FlexBox {
  return bubble(
    headerBox(COLOR.teal, "🎊 活動圓滿結束", "謝謝大家參加！"),
    bodyBox([
      {
        type: "box",
        layout: "vertical",
        alignItems: "center",
        backgroundColor: COLOR.tealLight,
        cornerRadius: "lg",
        paddingAll: "12px",
        contents: [
          { type: "text", text: String(p.checkinCount), size: "3xl", weight: "bold", color: COLOR.teal },
          { type: "text", text: "人完成簽到", size: "xs", color: "#666666" },
        ],
      },
      {
        type: "text",
        text: "離開前別忘了合照，或和今天聊得來的人交換聯絡方式。",
        size: "sm",
        color: "#555555",
        margin: "md",
        wrap: true,
      },
      { type: "text", text: "這場小聚體驗如何？", size: "xs", color: "#999999", margin: "md" },
    ]),
    footerBox([
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          messageButton("很喜歡", "很喜歡"),
          messageButton("還不錯", "還不錯"),
          messageButton("可以更好", "可以更好"),
        ],
      },
      postbackButton("🏁 結束活動", "end", "結束小聚", "primary", COLOR.teal),
    ]),
  );
}

function buildStatusCard(p: Extract<MeetupCardPayload, { kind: "status" }>): FlexBox {
  const effectivePhase = p.phase === MeetupPhase.PAUSED ? p.pausedFromPhase : p.phase;
  const currentIdx = effectivePhase ? MEETUP_FLOW.indexOf(effectivePhase) : -1;

  const progressRows = MEETUP_FLOW.map((phase, idx) => {
    const icon = idx < currentIdx ? "✅" : idx === currentIdx ? "▶️" : "⚪";
    const color = idx === currentIdx ? "#333333" : "#AAAAAA";
    const weight = idx === currentIdx ? "bold" : "regular";
    return {
      type: "text",
      text: `${icon} ${phaseLabel(phase)}`,
      size: "xs",
      color,
      weight,
    } as FlexBox;
  });

  const statusBadge = p.phase === MeetupPhase.PAUSED ? `${phaseLabel(p.phase)}` : phaseLabel(p.phase);

  const extraRows: FlexBox[] = [];
  if (p.currentIcebreaker) extraRows.push(detailRow("目前破冰題", p.currentIcebreaker));
  if (p.interactionType) extraRows.push(detailRow("互動環節", INTERACTION_TYPE_LABELS[p.interactionType]));

  return bubble(
    headerBox(COLOR.teal, `📊 ${p.name}`, `主辦人：${p.hostDisplayName}　${statusBadge}`),
    bodyBox([
      {
        type: "box",
        layout: "horizontal",
        contents: [
          detailRow("已進行", `${p.elapsedMinutes} 分鐘`),
          detailRow("預計時間", `${p.plannedMinutes ?? "未設定"} 分鐘`),
        ],
      },
      detailRow("已簽到", `${p.checkinCount} 人`),
      ...extraRows,
      { type: "separator", margin: "md" },
      { type: "text", text: "流程進度", weight: "bold", size: "sm", margin: "md" },
      ...progressRows,
    ]),
  );
}

export function buildMeetupCard(payload: MeetupCardPayload): messagingApi.Message | null {
  let contents: FlexBox;
  let altText: string;

  switch (payload.kind) {
    case "created":
      contents = buildCreatedCard(payload);
      altText = "小聚活動已建立";
      break;
    case "opening":
      contents = buildOpeningCard(payload);
      altText = `${payload.name} 即將開始`;
      break;
    case "checkin":
      contents = buildCheckinCard();
      altText = "簽到時間";
      break;
    case "icebreaker":
      contents = buildIcebreakerCard(payload);
      altText = "破冰問題";
      break;
    case "interaction":
      contents = buildInteractionCard(payload);
      altText = "互動環節";
      break;
    case "closing":
      contents = buildClosingCard(payload);
      altText = "活動圓滿結束";
      break;
    case "status":
      contents = buildStatusCard(payload);
      altText = "目前小聚狀態";
      break;
    default:
      return null;
  }

  return { type: "flex", altText, contents: contents as unknown as messagingApi.FlexBubble };
}
