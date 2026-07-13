import { messagingApi } from "@line/bot-sdk";
import { loadEnv } from "../config/env";

let client: messagingApi.MessagingApiClient | undefined;

export function getLineClient(): messagingApi.MessagingApiClient {
  if (!client) {
    const env = loadEnv();
    client = new messagingApi.MessagingApiClient({
      channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    });
  }
  return client;
}
