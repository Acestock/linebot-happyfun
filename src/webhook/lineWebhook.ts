import { Router } from "express";
import { middleware as lineMiddleware, type messagingApi, type webhook } from "@line/bot-sdk";
import { loadEnv } from "../config/env";
import { getLineClient } from "../line/client";
import { logger } from "../utils/logger";
import { upsertGroupFromEvent, upsertMemberFromEvent } from "../db/groupRepository";
import { buildHelpText, buildPartyMenu, isPartyCommand } from "../line/partyMenu";
import { cancelGame, handleGameMessage, startGame } from "../games/engine/sessionManager";

const GREETING =
  "嗨嗨～我是這個群組的氣氛組🎉\n" +
  "想玩遊戲的話，隨時輸入「party」打開遊戲選單，我會陪大家嗨起來！";

async function reply(replyToken: string, messages: messagingApi.Message[]): Promise<void> {
  await getLineClient().replyMessage({ replyToken, messages });
}

async function replyText(replyToken: string, text: string): Promise<void> {
  await reply(replyToken, [{ type: "text", text }]);
}

function parsePostbackData(data: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(data));
}

async function handleEvent(event: webhook.Event): Promise<void> {
  const group = await upsertGroupFromEvent(event);
  if (!group) return; // 只服務群組，一對一聊天先不處理

  const member = await upsertMemberFromEvent(event, group.id);

  if (event.type === "join" && event.replyToken) {
    await replyText(event.replyToken, GREETING);
    return;
  }

  if (event.type === "postback" && event.replyToken) {
    const data = parsePostbackData(event.postback.data);
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

    if (isPartyCommand(text)) {
      await reply(event.replyToken, [buildPartyMenu()]);
      return;
    }

    if (member) {
      const gameReply = await handleGameMessage(group.id, member.id, text);
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
