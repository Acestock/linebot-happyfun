import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

const CHANNEL_SECRET = "test-channel-secret";

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

describe("LINE webhook", () => {
  let app: import("express").Express;

  beforeAll(async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-access-token";
    process.env.LINE_CHANNEL_SECRET = CHANNEL_SECRET;
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
    process.env.REDIS_URL = "redis://localhost:6379";

    const { createApp } = await import("../../app");
    app = createApp();
  });

  it("returns 200 for a correctly signed request", async () => {
    const body = JSON.stringify({ destination: "xxx", events: [] });
    const signature = sign(body, CHANNEL_SECRET);

    const res = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Line-Signature", signature)
      .send(body);

    expect(res.status).toBe(200);
  });

  it("returns 401 for a request with an invalid signature", async () => {
    const body = JSON.stringify({ destination: "xxx", events: [] });

    const res = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .set("X-Line-Signature", "not-a-valid-signature")
      .send(body);

    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature header is missing", async () => {
    const body = JSON.stringify({ destination: "xxx", events: [] });

    const res = await request(app)
      .post("/webhook")
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(401);
  });

  it("healthz responds ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
