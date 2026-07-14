import { Router } from "express";
import { middleware as lineMiddleware, type messagingApi, type webhook } from "@line/bot-sdk";
import { loadEnv } from "../config/env";
import { getLineClient } from "../line/client";
import { logger } from "../utils/logger";
import { upsertGroupFromEvent, upsertMemberFromEvent } from "../db/groupRepository";
import { buildHelpText, buildPartyMenu, isPartyCommand } from "../line/partyMenu";
import { withPartyQuickReply, withQuickReply } from "../line/quickReply";
import { buildMeetupQuickReply } from "../line/meetupQuickReply";
import { buildMeetupCard } from "../line/meetupCards";
import { cancelGame, handleGameMessage, startGame } from "../games/engine/sessionManager";
import { handleMeetupPostback, handleMeetupText, type MeetupReply } from "../meetup/manager";

const GREETING =
  "嗨嗨～我是這個群組的氣氛組🎉\n" +
  "想玩遊戲的話，隨時輸入「party」打開遊戲選單，我會陪大家嗨起來！\n" +
  "想辦一場有主持人的小聚活動，輸入「建立小聚」試試看！";

async function reply(
  replyToken: string,
  messages: messagingApi.Message[],
  quickReply?: messagingApi.QuickReply,
): Promise<void> {
  const withQr = quickReply ? withQuickReply(messages, quickReply) : withPartyQuickReply(messages);
  await getLineClient().replyMessage({ replyToken, messages: withQr });
}

async function replyText(
  replyToken: string,
  text: string,
  quickReply?: messagingApi.QuickReply,
): Promise<void> {
  await reply(replyToken, [{ type: "text", text }], quickReply);
}

function parsePostbackData(data: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(data));
}

/** 小聚回覆：有卡片資料就送 Flex 卡片（高光時刻），沒有就送純文字（快問快答維持輕量） */
async function replyMeetup(replyToken: string, result: MeetupReply): Promise<void> {
  const quickReply = buildMeetupQuickReply(result.ui);
  const card = result.card ? buildMeetupCard(result.card) : null;
  if (card) {
    await reply(replyToken, [card], quickReply);
  } else {
    await replyText(replyToken, result.text, quickReply);
  }
}

async function handleEvent(event: webhook.Event): Promise<void> {
  const group = await upsertGroupFromEvent(event);
  if (!group) return; // 只服務群組，一對一聊天先不處理

  const member = await upsertMemberFromEvent(event, group.id);

  if (event.type === "join" && event.replyToken) {
    await replyText(event.replyToken, GREETING);
    return;
  }

  if (event.type === "leave") {
    // 被踢出/群組解散：標記不活躍，排程不再對它推播
    const { prisma } = await import("../db/prisma");
    await prisma.group
      .update({ where: { id: group.id }, data: { isActive: false } })
      .catch((err) => logger.warn({ err }, "failed to mark group inactive"));
    return;
  }

  if (event.type === "postback" && event.replyToken) {
    const data = parsePostbackData(event.postback.data);

    if (data.action === "meetup" && member) {
      const result = await handleMeetupPostback(group.id, member, data.cmd ?? "");
      if (result) {
        await replyMeetup(event.replyToken, result);
      }
      return;
    }

    switch (data.action) {
      case "help":
        await replyText(event.replyToken, buildHelpText());
        return;
      case "start_game": {
        const text = await startGame(group.id, data.game ?? "", member?.id ?? null);
        await replyText(event.replyToken, text);
        return;
      }
      case "cancel_game": {
        const text = await cancelGame(group.id);
        await replyText(event.replyToken, text);
        return;
      }
      default:
        return;
    }
  }

  if (event.type === "message" && event.message.type === "text" && event.replyToken) {
    const text = event.message.text;

    if (member) {
      const meetupReply = await handleMeetupText(group.id, member, text);
      if (meetupReply) {
        await replyMeetup(event.replyToken, meetupReply);
        return;
      }
    }

    if (isPartyCommand(text)) {
      await reply(event.replyToken, [buildPartyMenu()]);
      return;
    }

    if (member) {
      const gameReply = await handleGameMessage(group.id, member.id, member.displayName, text);
      if (gameReply) {
        await replyText(event.replyToken, gameReply);
      }
    }
    // 其他訊息保持沉默，不打擾群組聊天
  }
}

export function createLineWebhookRouter(): Router {
  const env = loadEnv();
  const router = Router();

  router.post(
    "/webhook",
    lineMiddleware({ channelSecret: env.LINE_CHANNEL_SECRET }),
    async (req, res) => {
      const events: webhook.Event[] = req.body.events ?? [];
      res.status(200).end();

      for (const event of events) {
        try {
          await handleEvent(event);
        } catch (err) {
          logger.error({ err, eventType: event.type }, "Failed to handle LINE event");
        }
      }
    },
  );

  return router;
}
