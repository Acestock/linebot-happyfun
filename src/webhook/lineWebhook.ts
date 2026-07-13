import { Router } from "express";
import { middleware as lineMiddleware, type webhook } from "@line/bot-sdk";
import { loadEnv } from "../config/env";
import { getLineClient } from "../line/client";
import { logger } from "../utils/logger";
import { upsertGroupFromEvent, upsertMemberFromEvent } from "../db/groupRepository";

const GREETING = "嗨嗨～我是這個群組的氣氛組！之後會在這裡主持小遊戲，敬請期待🎉";

async function handleEvent(event: webhook.Event): Promise<void> {
  const group = await upsertGroupFromEvent(event);
  if (group) {
    await upsertMemberFromEvent(event, group.id);
  }

  if (event.type === "join" && event.replyToken) {
    await getLineClient().replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: GREETING }],
    });
    return;
  }

  if (event.type === "message" && event.message.type === "text" && event.replyToken) {
    await getLineClient().replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: "收到！" }],
    });
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
