import { loadEnv } from "../config/env";
import { logger } from "../utils/logger";

export interface VerifiedIdToken {
  lineUserId: string;
}

/**
 * 驗證 LIFF 頁面帶來的 ID Token（前端呼叫 liff.getIDToken() 拿到）。
 * 直接呼叫 LINE 官方 verify endpoint，簽章驗證交給 LINE 做，不用自己引入 JWT 函式庫；
 * 拿到的 sub 就是這個使用者的 lineUserId。任何失敗都回傳 null，呼叫端一律當成未授權處理。
 */
export async function verifyLineIdToken(idToken: string): Promise<VerifiedIdToken | null> {
  const env = loadEnv();
  if (!env.LIFF_CHANNEL_ID) {
    logger.warn("LIFF_CHANNEL_ID not configured, cannot verify LIFF ID token");
    return null;
  }

  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: env.LIFF_CHANNEL_ID }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "LIFF ID token verification rejected");
      return null;
    }

    const json = (await res.json()) as { sub?: string };
    if (!json.sub) return null;
    return { lineUserId: json.sub };
  } catch (err) {
    logger.warn({ err }, "LIFF ID token verification request failed");
    return null;
  }
}
