# linebot-happyfun

LINE 群組「氣氛組」機器人 — 主持小遊戲、炒熱聊天氣氛，AI 即時生成主持文案。

架構規劃與設計理由請見 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。本 README 只涵蓋「如何跑起來」。

目前進度：**Phase 3 — AI 主持人文案（GPT-4o）**。主動排程（Phase 4）尚未實作。

開場白、獲勝宣布、中止收尾由 GPT-4o 以「阿密」人設即時生成（附防護規則與長度限制）；每次猜測的太大/太小提示維持即時固定文案（不耗 API、零延遲）。**沒有設定 `OPENAI_API_KEY` 時自動使用內建文案**，遊戲功能完全不受影響。要啟用 AI 文案，在 Railway Variables 加上 `OPENAI_API_KEY`（[OpenAI Platform](https://platform.openai.com/api-keys) 申請）。

## 怎麼玩

| 操作 | 說明 |
|---|---|
| 在群組輸入 `party` | 打開遊戲選單（Flex 圖卡），列出使用說明與目前的遊戲 |
| 點「🔢 終極密碼」 | 開一局猜數字（1~100），直接在群組輸入數字就是猜測，機器人提示太大/太小與剩餘範圍，猜中即結算並記錄戰績 |
| 點「📖 使用說明」 | 顯示玩法說明 |
| 點「🛑 結束目前遊戲」 | 中止進行中的遊戲並公布答案 |

機器人平常保持沉默，只在被 `party` 呼叫、遊戲互動、或加入群組打招呼時說話。

下面第 1 節是**完整、不需要在自己電腦上跑程式**的上線流程：建一個全新的 LINE 官方帳號，把這個 repo 直接部署到 Railway，兩邊接起來就能在真實 LINE 群組裡試用。本機開發（要改程式碼、加新功能時才需要）在第 4 節。

---

## 1. 快速上線：建立 LINE 官方帳號 + 部署到 Railway

整個流程分兩大塊、依序做：**先在 LINE 那邊拿到兩把 key，再去 Railway 部署並把 key 貼進去，最後回 LINE 那邊把網址接起來**。全程不需要 clone 這個 repo 到自己電腦、不需要裝 Node.js。

> 補充一個常見疑惑：LINE 有兩個後台——**LINE Official Account Manager**（`manager.line.biz`，管廣播訊息、圖文選單等「經營」功能）和 **LINE Developers Console**（`developers.line.biz`，管 API 串接）。這兩個後台指向同一個官方帳號，但只有 Developers Console 拿得到我們需要的 **Channel secret** 和 **Channel access token**。所以下面步驟直接在 Developers Console 建立帳號，不需要先去 Official Account Manager 申請。

### 步驟 1：建立 LINE 官方帳號（Messaging API channel）

1. 用你的 LINE 帳號登入 [LINE Developers Console](https://developers.line.biz/console/)。
2. 第一次登入會要求先建立一個 **Provider**（開發者/公司層級的分類，填你自己的名字或專案名稱都可以，例如 `acestock`），輸入後點 **Create**。
3. 進到 Provider 頁面後，點 **Create a Messaging API channel**（如果畫面是先選 channel 類型的清單，選 **Messaging API**）。
4. 依序填寫表單：
   - **Channel name**：機器人在 LINE 上顯示的名字，例如「阿密」（之後隨時可以在 Basic settings 改）
   - **Channel description**：隨便填一句話，使用者看得到
   - **Category** / **Subcategory**：選一個最接近的分類（例如 Entertainment）即可，不影響功能
   - **Email address**：預設會帶入你登入的帳號
   - 其他欄位（大頭貼、隱私權政策網址等）先留空沒關係
5. 勾選底下的條款同意框，點 **Create**。
6. 建立完成後會直接進到這個 channel 的管理頁面，上方有 **Basic settings** / **Messaging API** 這幾個分頁——這一步就已經同時建好了一個新的 LINE 官方帳號和它的 Messaging API 串接管道，不用再另外去別的地方申請帳號。

### 步驟 2：複製兩把 key（等一下要貼到 Railway）

建議先開一個記事本，把這兩個值複製下來備用：

1. 留在剛剛的 channel 頁面，點上方 **Basic settings** 分頁，找到 **Channel secret** 這一列，點右邊的複製圖示。
   → 這是 `LINE_CHANNEL_SECRET`
2. 點上方 **Messaging API** 分頁，往下捲，找到 **Channel access token** 區塊，點 **Issue**（第一次是空的，按下去才會產生）。產生後把它複製下來。
   → 這是 `LINE_CHANNEL_ACCESS_TOKEN`

先不用急著填到哪裡，步驟 5 會用到。

### 步驟 3：把這個 repo 部署到 Railway

1. 用 GitHub 帳號登入 [Railway](https://railway.app/)。
2. 點 **New Project** → **Deploy from GitHub repo**，選這個 repo（`acestock/linebot-happyfun`）。
   - 第一次串接會請你安裝並授權 Railway 的 GitHub App，照畫面指示允許存取這個 repo 即可。
3. 選好之後 Railway 會自動開始 build（它會偵測到 repo 裡的 `railway.json` + `Dockerfile`，不用手動設定 build 指令）。
4. **這次 build/啟動幾乎一定會失敗**，因為還沒有資料庫、也還沒填 LINE 的 key——這是預期中的狀況，繼續做步驟 4、5 補齊就會正常。

### 步驟 4：加上 PostgreSQL 與 Redis

1. 回到這個 Railway 專案的畫布（Project Canvas），點 **+ New** → **Database** → **Add PostgreSQL**。
2. 再點一次 **+ New** → **Database** → **Add Redis**。
3. 這樣專案裡會有三個服務：你的 Node 服務 + Postgres + Redis。點進你的 **Node 服務**（不是資料庫服務）→ **Variables** 分頁，把 `DATABASE_URL` 和 `REDIS_URL` 兩個變數用 **Add Reference**（或介面上等效的「參照」功能）分別指到 Postgres 服務的 `DATABASE_URL` 和 Redis 服務的 `REDIS_URL`。
   - 這步是「連結」不是「複製貼上」：連好之後這兩個值會自動跟著資料庫服務走，你不用手動貼任何連線字串。

### 步驟 5：填入 LINE 的兩把 key 和其他變數

還是在你的 **Node 服務** → **Variables** 分頁，用 **New Variable** 一個一個加：

| 變數名稱 | 填什麼 |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | 步驟 2 複製的 Channel access token |
| `LINE_CHANNEL_SECRET` | 步驟 2 複製的 Channel secret |
| `NODE_ENV` | `production` |

其他變數（`LLM_PROVIDER`、`PUSH_RATE_LIMIT_PER_GROUP_PER_HOUR` 等）先不用填，程式有內建預設值；`ANTHROPIC_API_KEY` 是之後 Phase 3 做 AI 文案才會用到，現在可以留空。完整清單見 [`.env.example`](./.env.example)。

填完存檔後 Railway 會自動觸發重新部署。到 **Deployments** 分頁點最新一次的部署看 log，正常會看到 migration 套用成功、接著是 `linebot-happyfun server started`。如果失敗看第 3 節「疑難排解」。

### 步驟 6：產生公開網址

1. 部署成功後，到 Node 服務的 **Settings** → **Networking**，點 **Generate Domain**。
2. 會得到一個像 `xxx.up.railway.app` 的網址，複製下來。

### 步驟 7：回 LINE 後台把網址接起來

1. 回到 [LINE Developers Console](https://developers.line.biz/console/) 你的 channel，點 **Messaging API** 分頁。
2. 找到 **Webhook settings** 區塊，把 **Webhook URL** 填成：`https://xxx.up.railway.app/webhook`（步驟 6 拿到的網址記得加上 `/webhook`）。
3. 把右邊的 **Use webhook** 開關打開。
4. 點 **Verify** 按鈕，應該會顯示 **Success**（這代表 Railway 上的服務真的收得到 LINE 打過來的請求）。
5. 往下找到 **LINE Official Account features** 區塊，把這兩個都關掉，不然官方預設的自動回覆會搶在我們自己的邏輯前面回話：
   - **Auto-reply messages** → 關閉
   - **Greeting messages** → 關閉

### 步驟 8：實際測試

1. 回 **Messaging API** 分頁最上方，掃 QR code（或用 Bot ID 搜尋）把機器人加為好友。
2. 到 **Basic settings** 分頁，確認 **Allow bot to join group chats** 是打開的（沒開的話沒辦法把機器人拉進群組）。
3. 開一個 LINE 群組（可以是只有你自己的測試群），把機器人拉進去：
   - 應該會馬上收到機器人的開場白（「嗨嗨～我是這個群組的氣氛組！...」）
4. 在群組裡打一句話：
   - 機器人應該回「收到！」

看到這兩個反應，代表從 LINE 官方帳號到 Railway 部署整條路都通了。

---

## 2. 疑難排解

| 現象 | 可能原因 / 排查方式 |
|---|---|
| 步驟 7 點 **Verify** 顯示失敗 | Railway 部署還沒成功（回步驟 5 看 Deployments log）；Webhook URL 少打了 `/webhook`；Railway 服務還在重啟中，等個 10-20 秒再試一次 |
| Verify 成功，但群組裡傳訊息機器人沒反應 | 確認步驟 7 的 **Auto-reply messages** / **Greeting messages** 真的關掉了；到 Railway 的 **Deployments → View Logs** 看有沒有 `invalid signature`（代表 `LINE_CHANNEL_SECRET` 貼錯或多貼了空白字元） |
| Railway log 出現 401 / signature 相關錯誤 | 回步驟 2 重新複製一次 Channel secret，貼回步驟 5 的 `LINE_CHANNEL_SECRET`，注意不要多複製到前後空白 |
| Railway log 出現 `Failed to handle LINE event` / Prisma 連不到資料庫 | 回步驟 4，確認 Node 服務的 `DATABASE_URL`／`REDIS_URL` 真的用 Reference 接到 Postgres/Redis 服務了，不是空的 |
| Railway deploy 卡在 `prisma migrate deploy` 那一步 | 通常是資料庫變數還沒生效就跑了 migration，在 Deployments 分頁點 **Redeploy** 重跑一次 |
| log 出現 `Could not parse schema engine response` 或 `Prisma failed to detect the libssl/openssl version` | Alpine 映像檔缺 OpenSSL 導致 Prisma 引擎啟動失敗；本專案 Dockerfile 已在 build/runtime 兩個 stage 加上 `apk add openssl` 並固定 `binaryTargets`，若還是遇到，確認你部署的是最新的 Dockerfile（重新 push 一次觸發 rebuild） |
| 機器人加不進群組 | 回步驟 8，確認 **Allow bot to join group chats** 有打開 |

---

## 3. 環境變數

完整列表、每個變數本機/Railway 分別怎麼填，見 [`.env.example`](./.env.example)。

### 成本控制提醒

Railway 依用量計費（執行時間、資料庫容量）。這個服務目前只有一個常駐 Node process（之後 Phase 4 會加 `node-cron`，用固定間隔掃描而非每秒輪詢），沒有額外的背景 worker 服務，LIFF 頁面也規劃直接掛在同一個服務下，避免多開一個 Railway 服務增加費用。

---

## 4. 進階：本機開發

只有在要繼續改程式碼、加新功能時才需要這一節；單純想試用機器人的話，做完第 1 節就結束了。

### 4.1 需求

- Node.js 20+
- Docker（跑本機 Postgres/Redis）
- 一個 LINE Messaging API channel（見第 1 節步驟 1、2）

### 4.2 安裝與啟動

```bash
npm install
cp .env.example .env
# 編輯 .env，至少填入 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET

docker compose up -d           # 起本機 Postgres + Redis
npx prisma migrate deploy       # 套用 schema
npm run dev                     # http://localhost:3000
```

### 4.3 讓 LINE 打得到本機（webhook 測試）

本機沒有公開 HTTPS，需要用 `ngrok`（或等效工具）把本機 port 暴露出去：

```bash
ngrok http 3000
```

把 ngrok 給的 HTTPS 網址 + `/webhook`（例如 `https://xxxx.ngrok-free.app/webhook`）暫時填進 LINE Developers Console 的 Webhook URL（測試完記得改回 Railway 的網址，不然正式環境會收不到事件）。

### 4.4 跑測試

```bash
npm test
```

目前涵蓋：webhook 簽章驗證（合法簽章 200、簽章錯誤/缺少簽章 401）、healthcheck。

### 4.5 專案結構

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

### 4.6 本機 / Railway 怎麼切換

程式碼只讀 `process.env.DATABASE_URL` / `process.env.REDIS_URL`，不寫死任何連線字串：

- 本機：這兩個值來自 `.env`（指向 `docker-compose.yml` 起的容器）
- Railway：這兩個值由 Postgres / Redis 服務的 Reference variable 自動帶入

所以完全不需要因為環境不同而改程式碼。

---

## 5. 未來擴充指引

新增遊戲類型（例如狼人殺）：在 `src/games/` 下新增一個模組，實作通用的 `GameEngine` 介面（見 `docs/ARCHITECTURE.md` 第 6 節），並在 `GameSessionManager` 的 registry 註冊對應的 `game_type` 字串。`game_sessions.config` / `game_moves.payload` 都是 JSONB，新遊戲不需要改資料庫 schema。

LIFF 視覺化頁面：`liff/` 目錄是獨立前端專案，透過 `src/api/routes/` 底下的 REST API 與後端溝通；新增頁面/遊戲畫面不需要改 webhook 或資料庫層。
