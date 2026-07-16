# LINE 群組氣氛組機器人 — 架構規劃文件

狀態：**草案，待確認**（本文件完成後暫不開始實作，待確認無誤才進入 Phase 1）

---

## 0. 產品定位摘要

機器人角色是群組的「氣氛組」：主持小遊戲、炒熱氣氛、部分文案由 AI 即時生成。核心護城河策略：

1. **群組記憶與個人化**：長期累積群組的哏、成員暱稱/風格、遊戲紀錄、活躍時段 → 用越久資料越厚，別人抄不走。
2. **LIFF 視覺化體驗**：文字先行，但架構從第一天就預留 LIFF 掛載點，之後直接加圖形化遊戲畫面而不用重構。

MVP 範圍：終極密碼（猜數字）＋開場白／閒置主動互動＋AI 人設文案（含防護與降級）。狼人殺、讀書會主持人等只做「架構上留位置」，不實作。

---

## 1. 技術選型與理由

| 項目 | 選擇 | 理由 |
|---|---|---|
| 語言 | TypeScript + Node.js 20 | 型別安全、生態成熟，`@line/bot-sdk`、Prisma 都是一線 TS 支援 |
| Web 框架 | **Express** | `@line/bot-sdk` 的 `line.middleware()` 是針對 Express 設計的，會自動處理 **raw body** 並驗證 `x-line-signature`；換成 Fastify 需要額外接 `fastify-raw-body` 自己重寫簽章驗證，多一層風險且沒有對應效益。這個 bot 的流量規模（小型群組聊天）不會遇到 Fastify 才有意義的效能瓶頸，Express 生態與範例更完整、維護成本更低，故選 Express。 |
| LINE SDK | `@line/bot-sdk`（官方） | 官方維護，內建 webhook 簽章驗證與 Push/Reply API 封裝 |
| ORM | **Prisma** | TypeScript-first、migration 工具內建、與 Railway Postgres 相容度高，schema 即文件，方便之後擴充新遊戲的 `config`/`payload` 用 `Json` 型別彈性擴充 |
| DB | PostgreSQL（正式資料）＋ Redis（即時狀態、計時器、rate limit） | 依需求指定 |
| 排程 | `node-cron`（跑在同一個 Node process 內） | 事件觸發＋固定間隔掃描，不常駐輪詢，符合 Railway 按用量計費的成本考量 |
| LLM | 透過抽象介面 `LLMClient`，預設 Anthropic Claude（`claude-haiku-4-5`，文案生成不需要最貴的模型），provider 可由環境變數切換 | 控制成本與延遲，介面抽象保留換 provider 的彈性 |
| 部署 | Railway（單一 Node 服務 + Postgres Plugin + Redis Plugin） | 需求指定；LIFF 頁面 MVP 階段直接由同一個 Express 服務用 `express.static` 掛在 `/liff` 路徑下，**不另開一個 Railway 服務**，避免多一份服務計費 |
| Logger | `pino` | 低開銷結構化 log，方便之後接可觀測性工具 |

---

## 2. 目錄結構

```
/
├── src/
│   ├── index.ts                 # entrypoint：啟動 Express + cron + 連線檢查
│   ├── app.ts                   # Express app 組裝（webhook route、REST API route）
│   ├── config/                  # env 讀取與 zod 驗證
│   ├── line/                    # LINE client 封裝（reply/push/getProfile）
│   ├── db/
│   │   └── prisma.ts            # PrismaClient 單例
│   ├── redis/
│   │   └── client.ts            # Redis 單例、session/lock 輔助函式
│   ├── games/
│   │   ├── engine/               # 通用遊戲狀態機框架（與遊戲類型無關）
│   │   │   ├── GameEngine.ts     # interface：onStart/onMessage/onTimeout/computeResult
│   │   │   ├── GameSessionManager.ts  # 依 groupId 找出目前 active session 並路由事件
│   │   │   └── types.ts
│   │   └── guess-number/         # 終極密碼模組（實作 GameEngine 介面）
│   │       ├── index.ts
│   │       ├── stateMachine.ts   # 純函式：(state, input) => nextState/result
│   │       └── commands.ts       # 文字指令解析（開局/猜測/取消）
│   ├── persona/
│   │   ├── systemPrompt.ts       # 三層 prompt 組裝
│   │   ├── templates/            # 各人設固定文案（含降級用預設文案）
│   │   ├── moderation.ts         # 長度限制／關鍵字黑名單／隱私過濾
│   │   └── llmClient.ts          # LLM 介面與 Anthropic 實作
│   ├── memory/
│   │   └── groupMemory.ts        # group_memory 讀寫、供 prompt 組裝使用
│   ├── scheduler/
│   │   ├── idleNudge.ts          # 閒置主動互動 cron job
│   │   └── gameTimeout.ts        # 遊戲逾時掃描 cron job
│   ├── webhook/
│   │   └── lineWebhook.ts        # 簽章驗證 + event router
│   ├── api/
│   │   └── routes/               # 給 LIFF 呼叫的 REST endpoint（/api/ping、/api/wordle/*、/api/one-a-two-b/*）
│   └── utils/logger.ts
├── prisma/
│   └── schema.prisma
├── liff/                         # 獨立前端專案（純 HTML/CSS/JS，不進 TS build）
│   ├── index.html                # 每日 Wordle 頁面（原規劃是 hello world，後來直接做成正式功能）
│   ├── wordle.css / wordle.js
│   └── one-a-two-b/              # 每日 1A2B 頁面，獨立子目錄對應獨立的 LIFF app
├── docker-compose.yml            # 本機 Postgres + Redis
├── Dockerfile
├── railway.json
├── .env.example
├── docs/
│   └── ARCHITECTURE.md
└── README.md
```

---

## 3. 資料模型（ER 圖）

```mermaid
erDiagram
    GROUPS ||--o{ GROUP_MEMBERS : has
    GROUPS ||--o{ GROUP_MEMORY : has
    GROUPS ||--o{ GAME_SESSIONS : hosts
    GAME_SESSIONS ||--o{ GAME_PARTICIPANTS : includes
    GAME_SESSIONS ||--o{ GAME_MOVES : logs
    GROUP_MEMBERS ||--o{ GAME_PARTICIPANTS : plays
    GROUP_MEMBERS ||--o{ GAME_MOVES : makes

    GROUPS {
      uuid id PK
      string line_group_id UK "LINE 的 groupId"
      string display_name "群組暱稱，可留空"
      string persona_style "目前啟用的人設"
      timestamp joined_at
      boolean is_active "被踢出/退出群組時設 false"
      timestamp memory_cleared_at "上次清空記憶的時間，可為 null"
    }
    GROUP_MEMBERS {
      uuid id PK
      uuid group_id FK
      string line_user_id "只有互動過才有"
      string display_name
      timestamp first_seen_at
      timestamp last_interacted_at
      int message_count
    }
    GROUP_MEMORY {
      uuid id PK
      uuid group_id FK
      string memory_type "running_joke | preferred_game | active_hours | custom_note"
      string key
      jsonb value
      float weight "供未來排序/淡出舊記憶"
      timestamp updated_at
    }
    GAME_SESSIONS {
      uuid id PK
      uuid group_id FK
      string game_type "guess_number，未來可擴充"
      string status "pending|active|finished|cancelled|timeout"
      jsonb config "遊戲客製參數，如猜數字範圍"
      timestamp started_at
      timestamp ended_at
      uuid winner_member_id FK "nullable"
      uuid started_by_member_id FK
    }
    GAME_PARTICIPANTS {
      uuid id PK
      uuid session_id FK
      uuid member_id FK
      timestamp joined_at
      int rank "nullable，結算後才有值"
      int guesses_count
    }
    GAME_MOVES {
      uuid id PK
      uuid session_id FK
      uuid member_id FK
      int move_index
      jsonb payload "如 {guess:42}"
      jsonb result "如 {direction:'higher'}"
      timestamp created_at
    }
```

**設計重點對應需求：**

- **隱私限制**：`group_members` 只在使用者主動觸發事件（訊息、postback、加入群組事件的來源 userId）時才會被建立，不假設能取得完整成員清單。沒有任何「預期成員名單」表。
- **可被 LLM 動態組裝**：`group_memory` 用 `memory_type + key + value(jsonb)` 的彈性結構，prompt 組裝時依 `weight`/`updated_at` 取前 N 筆轉成條列文字，不需要為每種記憶類型開新欄位。
- **遊戲可擴充**：`game_sessions.game_type` 是字串、`config`/`payload`/`result` 都是 JSONB，新增遊戲類型（如狼人殺）不需要改 schema，只需要新增對應的 `GameEngine` 實作模組。
- **Redis vs Postgres 分工**：Redis 存「進行中」的即時狀態（目前輪到誰、猜測範圍已縮小到多少、逾時計時器）方便高頻讀寫；Postgres 是系統真相來源，每一步 `game_moves` 落地一筆（單筆 insert 成本低，Railway 計費瓶頸主要是常駐運算與儲存量，不是這種輕量交易寫入），遊戲結束時才計算 `rank` 寫回 `game_participants`。

---

## 4. AI 主持人人設 — 待你選定

風格候選（先選一個當 MVP 預設，之後 `persona_style` 允許擴充多套，理論上可群組各自選）：

### 方案 A：活潑吐槽型（**建議**）
暫定名字：「阿密」。語氣浮誇、愛吐槽但不惡意，大量語助詞與表情符號。適合年輕、活躍、愛鬧的群組。
> 開場：「嗨嗨～本場終極密碼由本喵親自坐鎮，範圍 1~100，手腳慢的等等就等著看別人先猜中吧😏」
> 猜中：「哇賽是你？！運氣是不是都被你一個人用光了 這局你贏了，掌聲鼓勵鼓勵👏」

### 方案 B：溫和主持人型
暫定名字：「小暖」。像鄰家溫暖主持人，語氣親切有禮貌，適合年齡層較廣、氣氛偏溫和的群組。
> 開場：「大家好呀～現在開始一場終極密碼，範圍是 1 到 100，大家輪流猜猜看，我會提示大了還是小了唷！」
> 猜中：「恭喜 @小明 猜中了！這局你反應好快，真厲害～」

### 方案 C：莊家／儀式感型
暫定名字：「莊家先生」。以「賭場莊家」為主題包裝，語氣神秘、有儀式感，把猜數字包裝成小型賭局，差異化最強但風格較特殊，需要群組能接受這種調性。
> 開場：「各位貴賓，賭桌已經擺好，範圍 1 到 100，一個藏在暗處的數字正等著被揭曉，誰先猜中，誰就是今晚的幸運兒。」
> 猜中：「押對了！@小明，命運選中了你，這局的封號歸你所有。」

**由於互動工具剛好連線失敗，先用文字請你直接回覆選 A / B / C，或提出你自己的方案（含名字與語氣描述），我會在確認後把最終人設寫進文件與 Phase 3 的實作依據。**

---

## 5. AI 系統提示詞（system prompt）組成

三層疊加，於每次需要 LLM 生成文案時動態組裝：

1. **固定人設層**：機器人名字、語氣規則、可以做什麼/不能做什麼（例如：不評論政治、不透露其他玩家個資、回覆長度上限）。存在 `persona/templates/{style}.ts`，是靜態常數。
2. **群組記憶層**：從 `group_memory` 依 `group_id` 撈取前 N 筆（依 weight/更新時間排序，MVP 先抓 3~5 筆），組成「這個群組的小知識」條列文字插入 prompt。目的是讓文案聽起來「認識這群人」，但受限筆數與長度以控制 token 成本與離題風險。
3. **當下遊戲狀態層**：由呼叫端傳入結構化資料（遊戲類型、階段：開局/猜測中/結算、必要的顯示名稱、已計算好的結果），**LLM 只負責把已經算好的結果「講出來」，不負責判斷輸贏本身** —— 遊戲邏輯永遠在確定性的狀態機裡完成，避免玩家用聊天內容注入影響公平性，也讓 LLM 呼叫失敗時容易被寫死文案取代。

```
interface LLMClient {
  generate(input: {
    personaStyle: string;
    memorySnippets: string[];
    gameContext: Record<string, unknown>;
    intent: "opening" | "guess_feedback" | "result" | "idle_nudge";
  }): Promise<string>;
}
```
（僅列介面示意，尚未實作）

### 內容防護（生成後、發送前）
- 長度硬上限（超過就截斷或改用降級文案）
- 關鍵字黑名單（髒話、隱私相關詞如電話/地址格式的正則、政治敏感詞）
- 不得包含除了「當下遊戲情境明確允許」以外的其他玩家個資（LLM prompt 裡本來就只給顯示名稱，不給 userId/真實資料，從輸入端就先做隔離）
- 兩次生成都未通過防護 → 直接落到降級文案，不重試第三次（控制延遲與 LLM 呼叫成本）

### 降級方案
每個 `intent` × 每個 persona 都各自準備一組寫死的預設文案（`persona/templates/{style}/fallback.ts`），觸發時機：LLM 逾時（建議 3 秒）、API 錯誤、輸出未通過防護。降級文案保證遊戲流程永遠不會卡住。

---

## 6. 遊戲狀態機設計（通用框架 + 終極密碼實作）

```
interface GameEngine<TConfig, TState, TMoveInput, TResult> {
  gameType: string;
  init(config: TConfig): TState;
  onMove(state: TState, input: TMoveInput): { nextState: TState; feedback: unknown };
  isFinished(state: TState): boolean;
  computeResult(state: TState): TResult;
}
```
（僅列介面示意，尚未實作）

`GameSessionManager` 負責：依 `group_id` 從 Redis 找目前 active session → 依 `game_type` 找出對應 `GameEngine` 實作 → 呼叫 `onMove` → 更新 Redis 狀態並非同步落一筆 `game_moves` 到 Postgres → 若 `isFinished` 則呼叫 `computeResult`、寫入 `game_participants.rank`、清掉 Redis key、觸發 AI 結算文案。

終極密碼（`guess-number`）的 `TState` 大致包含：`{ min, max, currentMin, currentMax, turnOrder, currentTurnIndex, attempts[] }`，`onMove` 驗證輪到誰、比較猜測與答案、回傳「大了/小了/猜中」。

新增遊戲類型（例如未來的狼人殺）只需要：新增一個 `games/<new-game>/` 模組實作 `GameEngine`，在 `GameSessionManager` 的 registry 註冊 `game_type` 字串，`game_sessions.config`/`game_moves.payload` 用該遊戲自訂的 JSON 形狀即可，**不需要改任何既有資料表欄位或既有遊戲的程式碼**。

---

## 7. 主動互動排程

兩個 `node-cron` job，跑在同一個 Node process（不另開 worker service，避免多一份 Railway 計費）：

| Job | 頻率（可調） | 邏輯 |
|---|---|---|
| `gameTimeout` | 每 2 分鐘掃描一次 | 找 Redis 裡逾時未操作的 active session → 標記 `timeout`、用 Push 公告、清狀態 |
| `idleNudge` | 每 30 分鐘掃描一次 | 找 `last_interacted_at`／群組層級最後活動時間超過門檻（如 3 小時）、且在允許的活躍時段內、且該群組本小時 Push 次數未超過上限的群組 → 挑一個輕量互動（今日一句話／小謎題）→ AI 生成（含降級）→ Push |

**Push 頻率上限**：Redis 計數器 `push:{groupId}:{hourBucket}`，超過設定值（例如每群組每小時最多 2 則主動推播）就跳過該群組本輪推播。區分清楚：**回覆玩家訊息用 Reply API（免費、在 webhook 處理當下用 replyToken 回，僅遊戲互動內文案走這條路）**；**只有沒有對應使用者事件可回覆的情境（逾時公告、閒置主動互動）才用 Push API（計費）**，架構上刻意把遊戲的即時猜測回饋設計成 Reply 而非 Push，這是主要的成本控制手段。

---

## 8. 部署與環境切換

### Railway 服務配置
- 單一 Node 服務（Express app），內含 webhook、REST API、cron。
- Postgres：Railway Postgres Plugin，注入 `DATABASE_URL`。
- Redis：Railway Redis Plugin，注入 `REDIS_URL`。
- LIFF 靜態頁面 MVP 階段由同一服務 `express.static('/liff', ...)` 提供，不另開服務。
- `railway.json` 指定 build/start；啟動指令包含 `prisma migrate deploy` 再啟動 server，確保正式環境 schema 自動跟上。
- Dockerfile 採 multi-stage build（安裝依賴 → `prisma generate` + TS build → 產出精簡 runtime image），避免正式環境帶著開發依賴，控制 image 大小與啟動時間。

### 本機開發
- `docker-compose.yml` 起本機 Postgres 16 + Redis 7。
- `.env` 指向本機容器（如 `postgresql://postgres:postgres@localhost:5432/linebot`、`redis://localhost:6379`）。
- webhook 本機測試需要 `ngrok`（或等效工具）把本機 port 暴露成 HTTPS 供 LINE Developers Console 設定。

### 兩種模式怎麼切換
程式碼一律只讀 `process.env.DATABASE_URL` / `process.env.REDIS_URL` 等，不寫死任何連線資訊。本機模式這兩個變數來自 `.env`（指向 docker-compose 服務）；Railway 正式環境這兩個變數由 Postgres/Redis Plugin **自動注入**，不需要在 Railway Variables 手動填。**不需要改一行程式碼**，純粹是「這兩個變數的值從哪裡來」的差異。

### `.env.example` 會列出的變數（Phase 1 建立骨架時一併產出，目前先列名稱供確認）

| 變數 | 本機來源 | Railway 來源 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console | 手動填入 Railway Variables |
| `LINE_CHANNEL_SECRET` | LINE Developers Console | 手動填入 Railway Variables |
| `DATABASE_URL` | docker-compose 本機 Postgres | Postgres Plugin 自動注入 |
| `REDIS_URL` | docker-compose 本機 Redis | Redis Plugin 自動注入 |
| `ANTHROPIC_API_KEY` | 開發者自己的 key | 手動填入 Railway Variables |
| `LLM_PROVIDER`（預設 `anthropic`） | `.env` | Railway Variables |
| `LLM_MODEL`（預設 `claude-haiku-4-5`） | `.env` | Railway Variables |
| `PORT` | `.env`（如 3000） | Railway 自動提供 |
| `NODE_ENV` | `development` | `production` |
| `PUSH_RATE_LIMIT_PER_GROUP_PER_HOUR`（預設 2） | `.env` | Railway Variables |
| `IDLE_NUDGE_THRESHOLD_MINUTES` / `IDLE_NUDGE_SWEEP_INTERVAL_MINUTES` | `.env` | Railway Variables |
| `GAME_TIMEOUT_MINUTES` / `GAME_TIMEOUT_SWEEP_INTERVAL_MINUTES` | `.env` | Railway Variables |
| `INTERNAL_STATS_TOKEN`（保護內部統計 endpoint） | `.env` | Railway Variables |
| `LIFF_ID`（每日 Wordle LIFF app 的 ID） | `.env` | Railway Variables |
| `LIFF_ID_ONE_A_TWO_B`（每日 1A2B LIFF app 的 ID，同一個 LINE Login channel 底下另開一個） | `.env` | Railway Variables |
| `LIFF_CHANNEL_ID`（該 LINE Login channel 的 Channel ID，兩個 LIFF app 共用，驗證 ID token 用） | `.env` | Railway Variables |

---

## 9. 非功能需求對應

- **成本控制**：見第 7 節 Push 分流設計；cron 用固定間隔掃描而非每秒輪詢；LLM 預設用便宜/快的模型且有降級，避免重試風暴。
- **安全性**：`line.middleware()` 驗證簽章；所有密鑰走環境變數；`.env`、`docker-compose.override.yml` 等進 `.gitignore`；Prisma 連線字串不進版控。
- **隱私**：`group_members` 只存互動後才拿得到的最小資料；規劃管理指令（如「/清空記憶」）清空該群組 `group_memory`。**已知限制**：LINE Messaging API 不提供「誰是群組管理員」的資訊，無法用官方 API 驗證下指令者是否為群管理員；MVP 先開放群內任何成員可下指令，但要求輸入後有一次確認（例如 30 秒內回覆「確定」）以避免誤觸，之後若有更嚴謹的權限需求需要另外設計（例如綁定邀請機器人的人）。
- **可觀測性**：`pino` 結構化 log 記錄 webhook 接收、遊戲開始/結束、LLM 呼叫延遲與失敗、Push 是否因超過頻率上限被跳過；提供一個用 token 保護的 `/internal/stats` endpoint，直接查 Postgres 算「活躍群組數（近 7 天有活動）」「總遊戲局數」等簡單統計，MVP 不需要另外接分析平台。

---

## 10. 分階段實作計畫（確認架構後依序進行，每階段完成即驗收）

| Phase | 內容 | 驗收/測試方式 |
|---|---|---|
| 1 | 專案骨架：Express app、Prisma schema 與初始 migration、Redis 連線、webhook 簽章驗證＋任何訊息先回「收到！」、docker-compose、Dockerfile、railway.json、.env.example、README | 本機跑起來＋ngrok，在測試群組傳訊息確認有回覆；補一個簽章驗證函式的單元測試 |
| 2 | 終極密碼完整流程：開局／猜測／結算／名次記錄，`GameEngine` 框架 | 狀態機純函式的單元測試（給定狀態+輸入→驗證輸出）；本機模擬多輪事件的腳本測試；真實群組手動測試完整一局 |
| 3 | AI 人設文案（取代 Phase 2 的寫死文案）＋防護＋降級 | 防護規則的單元測試（黑名單觸發案例）；手動關閉/餵錯 API key 驗證降級文案生效；真實群組人工檢視語氣是否符合人設 |
| 4 | 主動互動排程（閒置互動＋逾時掃描）＋ Push 頻率限制 | 本機把門檻/間隔調短做手動驗證；驗證超過頻率上限時第二則 Push 會被擋下；驗證忘記回覆的遊戲會被逾時收尾 |
| 5（stretch，後來實作為完整功能） | 每日 Wordle：LIFF 頁面＋共用 API 路由＋新的平行資料模型（`WordlePuzzle`/`WordleAttempt`，跟遊戲引擎/Meetup 一樣不共用既有 session 機制） | 純邏輯（字母回饋演算法）的單元測試；真的本機 Postgres 跑 smoke script 驗證完整一局勝/敗＋排行榜排序；LIFF 畫面本身無法自動化測試，需部署後在 LINE App 內手動驗證 |

---

## 11. 待你確認的事項

1. **人設風格**：A（活潑吐槽）／B（溫和主持人）／C（莊家儀式感）／你自己的方案？
2. 上述技術選型（Express、Prisma、Anthropic Claude Haiku 作為預設 LLM）是否都 OK，或有指定要用的服務？
3. 架構本身（資料模型、狀態機、排程與成本控制設計）是否同意，可以進入 Phase 1？

確認後我會照上面的分階段計畫開始實作，並在每個 Phase 結束時回報對應的測試方式與結果，不會一次做完才給你看。
