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

## 3. 從 0 建立 LINE Bot（LINE Developers Console）

### 3.1 建立 Provider 與 Messaging API Channel

1. 用你的 LINE 帳號登入 [LINE Developers Console](https://developers.line.biz/console/)。第一次登入會要求建立一個 **Provider**（可以想成「開發者/公司」這個層級的分類，例如填你的名字或專案名稱），輸入名稱後建立即可。
2. 在該 Provider 底下點 **Create a new channel**，選擇 **Messaging API**。
3. 填寫 channel 建立表單：
   - **Channel name**：機器人顯示名稱，之後 LINE 群組成員會看到（可先填暫定人設名字，例如「阿密」，之後想改可以隨時在 Basic settings 改）
   - **Channel description**：隨意填，使用者看得到
   - **Category / Subcategory**：依實際用途選最接近的分類即可
   - **Email address**：預設帶入你的帳號 email
   - 其餘（頭像、隱私權政策 URL 等）MVP 階段可以留空或之後再補
4. 勾選同意條款後建立。建立完成會進到這個 channel 的管理頁面，上方分頁列有 **Basic settings** / **Messaging API** / **Statistics** 等。

### 3.2 取得 Channel Secret 與 Channel Access Token

這兩把 key 分別對應 `.env` 的 `LINE_CHANNEL_SECRET` 和 `LINE_CHANNEL_ACCESS_TOKEN`，服務啟動時會驗證這兩個環境變數存在（見 `src/config/env.ts`）：

1. 到 **Basic settings** 分頁，找到 **Channel secret**，點旁邊複製圖示複製起來 → 貼進 `.env` 的 `LINE_CHANNEL_SECRET`。這是用來驗證 webhook 請求簽章的密鑰，`src/webhook/lineWebhook.ts` 用它確認收到的請求真的來自 LINE，不能外流。
2. 到 **Messaging API** 分頁，往下捲到 **Channel access token** 區塊，點 **Issue** 發行一組 **long-lived** token → 貼進 `.env` 的 `LINE_CHANNEL_ACCESS_TOKEN`。這是用來呼叫 LINE API（回覆訊息、主動推播）的憑證，一樣不能外流、不要進版控。

### 3.3 開啟 Webhook，關閉官方預設自動回覆

同樣在 **Messaging API** 分頁：

1. **Webhook settings** 區塊：
   - 填入 **Webhook URL** = 你的服務網址 + `/webhook`（本機測試先填 ngrok 網址，例如 `https://xxxx.ngrok-free.app/webhook`；部署到 Railway 後再回來改成 Railway 網域，見第 4.5 節）
   - 把 **Use webhook** 打開
   - 服務跑起來、Webhook URL 填好之後可以點旁邊的 **Verify** 按鈕，成功會顯示 Success（這步驟會實際打一次你的 `/webhook`，本機測試要先把 `npm run dev` 和 ngrok 都啟動著）
2. **LINE Official Account features** 區塊，把以下兩個都關閉，不然 LINE 官方預設的自動回覆會跟這個機器人自己的邏輯打架：
   - **Auto-reply messages** → Disabled
   - **Greeting messages** → Disabled（機器人自己的開場白由 `src/webhook/lineWebhook.ts` 在收到 `join` 事件時發送）

### 3.4 把機器人加入群組測試

1. 在 **Messaging API** 分頁上方可以看到這個 channel 的 QR code / Bot ID，用手機掃描或搜尋加為好友。
2. 到 **Basic settings** 分頁，把 **Allow bot to join group chats** 打開（沒開的話機器人沒辦法被拉進群組）。
3. 把機器人拉進一個你自己的測試群組。
4. 驗收：
   - 機器人剛被拉進群組時，應該會自動送出開場白（「嗨嗨～我是這個群組的氣氛組！...」）
   - 在群組裡發一則文字訊息，機器人應該回「收到！」
   - 如果沒反應，先看第 5 節「疑難排解」

## 4. 部署到 Railway

### 4.1 建立 Railway 專案並接上這個 repo

1. 用 GitHub 帳號登入 [Railway](https://railway.app/)。
2. **New Project** → **Deploy from GitHub repo**，選這個 repo（`acestock/linebot-happyfun`），選要部署的分支。
   - 如果是第一次串接，Railway 會請你安裝 GitHub App 並授權存取這個 repo。
3. Railway 會自動偵測到專案根目錄的 `railway.json` + `Dockerfile`，用 Docker build（不需要另外設定 build 指令）。第一次 build 可能會因為缺環境變數而啟動失敗，屬正常現象，接著做 4.2、4.3 補齊即可。

### 4.2 加 PostgreSQL 與 Redis Plugin

1. 在同一個 Railway 專案畫布裡點 **+ New** → **Database** → **Add PostgreSQL**。
2. 再點一次 **+ New** → **Database** → **Add Redis**。
3. 加入後 Railway 會分別建立兩個服務，並自動把 `DATABASE_URL` / `REDIS_URL` 這兩個變數 inject 到同專案內其他服務可以參照（新版 Railway 介面下，通常需要在你的主服務 Variables 分頁用 **Add Reference** 從 Postgres/Redis 服務參照這兩個變數；如果介面沒有自動連好，手動加一個 reference variable 指到 Postgres 服務的 `DATABASE_URL` 和 Redis 服務的 `REDIS_URL` 即可）。**不需要**自己手動貼連線字串。

### 4.3 設定環境變數

到你的 Node 服務（不是 Postgres/Redis 那兩個）的 **Variables** 分頁，比照 [`.env.example`](./.env.example) 補上標示「Railway: 手動填入 Variables」的變數：

| 變數 | 值從哪裡來 |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | 第 3.2 節取得 |
| `LINE_CHANNEL_SECRET` | 第 3.2 節取得 |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) 申請（Phase 3 才會真正用到，可以先留空，AI 文案生成上線前補上即可） |
| `NODE_ENV` | 填 `production` |
| `LLM_PROVIDER` / `LLM_MODEL` / `PUSH_RATE_LIMIT_PER_GROUP_PER_HOUR` 等 | 有預設值，不填也會用程式內建預設，想調整才需要填 |

`DATABASE_URL` / `REDIS_URL` 不要手動填，交給第 4.2 節的 Plugin reference。`PORT` 也不用填，Railway 會自動注入並由 `src/index.ts` 讀取。

### 4.4 Deploy 並確認 migration 有跑成功

1. 補完變數後 Railway 會自動觸發重新部署（或手動點 **Deploy**）。
2. 到 **Deployments** 分頁看 build/deploy log，啟動指令是 `npx prisma migrate deploy && node dist/index.js`（設在 `railway.json`），正常會看到 migration apply 成功的訊息，接著是 `linebot-happyfun server started`。
3. 如果 log 卡在連不到資料庫，回頭檢查 4.2 的 `DATABASE_URL` reference 是否真的接上了。

### 4.5 產生公開網域，回填 LINE Webhook URL

1. 到這個 Node 服務的 **Settings → Networking**，點 **Generate Domain**，會得到一個 `xxx.up.railway.app` 網域。
2. 回到 LINE Developers Console 的 **Messaging API** 分頁，把 Webhook URL 改成 `https://xxx.up.railway.app/webhook`，點 **Verify** 確認回 Success。
3. 用手機在真實 LINE 群組再測一次「機器人回『收到！』」「機器人被加入群組會送開場白」，這次是打正式環境，代表 Railway 部署完整跑通。

### 本機 / Railway 怎麼切換

程式碼只讀 `process.env.DATABASE_URL` / `process.env.REDIS_URL`，不寫死任何連線字串：

- 本機：這兩個值來自 `.env`（指向 `docker-compose.yml` 起的容器）
- Railway：這兩個值由 Postgres / Redis Plugin **自動注入**（reference variable）

所以完全不需要因為環境不同而改程式碼。

### 成本控制提醒

Railway 依用量計費（執行時間、資料庫容量）。這個服務目前只有一個常駐 Node process（之後 Phase 4 會加 `node-cron`，用固定間隔掃描而非每秒輪詢），沒有額外的背景 worker 服務，LIFF 頁面也規劃直接掛在同一個服務下，避免多開一個 Railway 服務增加費用。

## 5. 疑難排解

| 現象 | 可能原因 / 排查方式 |
|---|---|
| LINE Console 點 Verify 顯示失敗 | 服務沒在跑（本機沒開 `npm run dev`/ngrok，或 Railway 部署失敗）；Webhook URL 打錯（要含 `/webhook`）；防火牆/ngrok session 過期 |
| 群組裡傳訊息機器人沒反應，但 Verify 是成功的 | 檢查 `LINE_CHANNEL_SECRET` 是否填對（簽章驗證失敗會回 401，可以看 server log 或 Railway log 裡的 `invalid signature`）；確認第 3.3 節的 Auto-reply/Greeting messages 已關閉，避免被官方預設功能截走 |
| 機器人回覆不出來、log 顯示 401 | 幾乎都是 `LINE_CHANNEL_SECRET` 貼錯或多了空白字元 |
| 機器人有回但 log 顯示 `Failed to handle LINE event` / Prisma 連線錯誤 | `DATABASE_URL` 沒接好（本機沒跑 `docker compose up -d`，或 Railway 的 Postgres reference 沒接上） |
| Railway deploy 失敗在 `prisma migrate deploy` 那步 | 通常是 `DATABASE_URL` 還沒生效就跑了 migration；重新觸發一次 deploy，或確認 Postgres 服務本身狀態正常 |
| 機器人加不進群組 | 第 3.4 節的 **Allow bot to join group chats** 沒打開 |

## 6. 環境變數

完整列表與各變數在本機/Railway 分別怎麼設定，見 [`.env.example`](./.env.example)。

## 7. 未來擴充指引

新增遊戲類型（例如狼人殺）：在 `src/games/` 下新增一個模組，實作通用的 `GameEngine` 介面（見 `docs/ARCHITECTURE.md` 第 6 節），並在 `GameSessionManager` 的 registry 註冊對應的 `game_type` 字串。`game_sessions.config` / `game_moves.payload` 都是 JSONB，新遊戲不需要改資料庫 schema。

LIFF 視覺化頁面：`liff/` 目錄是獨立前端專案，透過 `src/api/routes/` 底下的 REST API 與後端溝通；新增頁面/遊戲畫面不需要改 webhook 或資料庫層。
