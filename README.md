# linebot-happyfun

LINE 群組「氣氛組」機器人 — 主持小遊戲、炒熱聊天氣氛，AI 即時生成主持文案。

架構規劃與設計理由請見 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。本 README 只涵蓋「如何跑起來」。

目前進度：**Phase 1 — 專案骨架、資料庫 schema、webhook 收發**（收到訊息會回覆「收到！」、機器人加入群組會送開場白，並開始記錄 `groups`/`group_members`）。終極密碼遊戲、AI 文案生成、主動排程尚未實作。

## 1. 專案結構

```
src/
├── index.ts        # entrypoint
├── app.ts           # Express app 組裝
├── config/           # 環境變數驗證（zod）
├── db/                # Prisma client、群組/成員 upsert
├── redis/             # Redis client
├── line/              # LINE Messaging API client
├── webhook/            # LINE webhook（簽章驗證 + 事件處理）
└── api/routes/          # 給 LIFF 用的 REST API（目前只有 /api/ping）
prisma/schema.prisma      # 資料庫 schema
liff/                      # LIFF 前端（尚未建立，規劃於 Phase 5）
```

## 2. 本機開發

### 2.1 需求

- Node.js 20+
- Docker（跑本機 Postgres/Redis）
- 一個 LINE Messaging API channel（見第 3 節）

### 2.2 安裝與啟動

```bash
npm install
cp .env.example .env
# 編輯 .env，至少填入 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET

docker compose up -d           # 起本機 Postgres + Redis
npx prisma migrate deploy       # 套用 schema
npm run dev                     # http://localhost:3000
```

### 2.3 讓 LINE 打得到本機（webhook 測試）

本機沒有公開 HTTPS，需要用 `ngrok`（或等效工具）把本機 port 暴露出去：

```bash
ngrok http 3000
```

把 ngrok 給的 HTTPS 網址 + `/webhook`（例如 `https://xxxx.ngrok-free.app/webhook`）填進 LINE Developers Console 的 Webhook URL。

### 2.4 跑測試

```bash
npm test
```

目前涵蓋：webhook 簽章驗證（合法簽章 200、簽章錯誤/缺少簽章 401）、healthcheck。

## 3. 設定 LINE Developers Console

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立一個 Provider，底下建立一個 **Messaging API** channel。
2. 在該 channel 的 **Messaging API** 分頁：
   - 打開「Use webhook」
   - 把 Webhook URL 設成你的服務網址 + `/webhook`（本機測試用 ngrok 網址，正式環境用 Railway 網域）
   - 關閉「Auto-reply messages」「Greeting messages」（避免跟本機器人自己的開場白衝突）
3. 在 **Basic settings** 分頁複製 **Channel secret** → `.env` 的 `LINE_CHANNEL_SECRET`
4. 在 **Messaging API** 分頁下方發行一組 **Channel access token (long-lived)** → `.env` 的 `LINE_CHANNEL_ACCESS_TOKEN`
5. 把機器人加進一個測試群組，傳一則訊息，應該會收到「收到！」的回覆；把機器人踢出再重新加入群組，應該會收到開場白。

## 4. 部署到 Railway

1. 在 Railway 建一個新專案，把這個 repo 接上去（Railway 會偵測到 `railway.json` + `Dockerfile` 自動用 Docker build）。
2. 在同一個 Railway 專案內加兩個 Plugin：**PostgreSQL** 和 **Redis**。加入後 Railway 會自動把 `DATABASE_URL` / `REDIS_URL` 注入到你的服務環境變數，**不需要手動填**。
3. 到你的服務的 **Variables** 分頁，手動填入 `.env.example` 裡標示「Railway: 手動填入 Variables」的變數（`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`、`ANTHROPIC_API_KEY` 等），並把 `NODE_ENV` 設為 `production`。
4. Deploy。啟動指令（`railway.json` 已設定）會先跑 `prisma migrate deploy` 套用 schema，再啟動服務。
5. 到 Railway 服務設定取得公開網域（Settings → Networking → Generate Domain），把它 + `/webhook` 填回 LINE Developers Console 的 Webhook URL。

### 本機 / Railway 怎麼切換

程式碼只讀 `process.env.DATABASE_URL` / `process.env.REDIS_URL`，不寫死任何連線字串：

- 本機：這兩個值來自 `.env`（指向 `docker-compose.yml` 起的容器）
- Railway：這兩個值由 Postgres / Redis Plugin **自動注入**

所以完全不需要因為環境不同而改程式碼。

### 成本控制提醒

Railway 依用量計費（執行時間、資料庫容量）。這個服務目前只有一個常駐 Node process（之後 Phase 4 會加 `node-cron`，用固定間隔掃描而非每秒輪詢），沒有額外的背景 worker 服務，LIFF 頁面也規劃直接掛在同一個服務下，避免多開一個 Railway 服務增加費用。

## 5. 環境變數

完整列表與各變數在本機/Railway 分別怎麼設定，見 [`.env.example`](./.env.example)。

## 6. 未來擴充指引

新增遊戲類型（例如狼人殺）：在 `src/games/` 下新增一個模組，實作通用的 `GameEngine` 介面（見 `docs/ARCHITECTURE.md` 第 6 節），並在 `GameSessionManager` 的 registry 註冊對應的 `game_type` 字串。`game_sessions.config` / `game_moves.payload` 都是 JSONB，新遊戲不需要改資料庫 schema。

LIFF 視覺化頁面：`liff/` 目錄是獨立前端專案，透過 `src/api/routes/` 底下的 REST API 與後端溝通；新增頁面/遊戲畫面不需要改 webhook 或資料庫層。
