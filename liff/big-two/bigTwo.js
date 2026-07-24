// 大老二對戰 — 純 vanilla JS，沒有建構工具，直接被 index.html 當一般 <script> 載入。
// 跟 liff/wordle.js／liff/one-a-two-b/oneATwoB.js 不同：這裡是短輪詢架構（沒有
// WebSocket），畫面靠 setInterval 固定間隔打 /state 拉最新桌況，機器人回合／真人超時
// 接管都在後端 manager.ts 懶惰處理，前端只要負責顯示跟送出「我要出牌／跳過」。

const API_BASE = "/api/big-two";
const POLL_INTERVAL_MS = 1800;
const TURN_TIME_LIMIT_MS = 45000; // 純視覺用，要跟 src/big-two/manager.ts 的 TURN_TIME_LIMIT_SECONDS 對齊
const SUIT_SYMBOLS = { D: "♦", C: "♣", H: "♥", S: "♠" };
const RED_SUITS = new Set(["D", "H"]);
const RANK_MEDALS = ["🥇", "🥈", "🥉", "🏅"];

const el = {
  subtitle: document.getElementById("subtitle"),
  message: document.getElementById("message"),
  helpButton: document.getElementById("help-button"),
  tutorial: document.getElementById("tutorial"),
  tutorialClose: document.getElementById("tutorial-close"),
  toast: document.getElementById("toast"),

  noGameScreen: document.getElementById("no-game-screen"),
  createButton: document.getElementById("create-button"),

  lobbyScreen: document.getElementById("lobby-screen"),
  lobbySeats: document.getElementById("lobby-seats"),
  joinRow: document.getElementById("join-row"),
  joinButton: document.getElementById("join-button"),
  hostControls: document.getElementById("host-controls"),
  botMinus: document.getElementById("bot-minus"),
  botPlus: document.getElementById("bot-plus"),
  botCount: document.getElementById("bot-count"),
  startButton: document.getElementById("start-button"),
  waitingText: document.getElementById("waiting-text"),

  tableScreen: document.getElementById("table-screen"),
  seatStrip: document.getElementById("seat-strip"),
  timerBar: document.getElementById("timer-bar"),
  timerFill: document.getElementById("timer-fill"),
  turnBanner: document.getElementById("turn-banner"),
  trickLabel: document.getElementById("trick-label"),
  trickPlays: document.getElementById("trick-plays"),
  handArea: document.getElementById("hand-area"),
  playButton: document.getElementById("play-button"),
  passButton: document.getElementById("pass-button"),

  finishedScreen: document.getElementById("finished-screen"),
  finishedRanks: document.getElementById("finished-ranks"),
  playAgainButton: document.getElementById("play-again-button"),
};

const TUTORIAL_SEEN_KEY = "big_two_tutorial_seen";

function showTutorial() {
  el.tutorial.hidden = false;
}

function hideTutorial() {
  el.tutorial.hidden = true;
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch (err) {
    // 有些瀏覽器的隱私模式會擋 localStorage，擋掉也不影響遊戲本身，只是每次都會再彈一次說明
  }
}

function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === "1";
  } catch (err) {
    return false;
  }
}

const state = {
  groupId: null,
  idToken: null,
  game: null, // GameView | null
  selected: new Set(),
  acting: false,
  pollHandle: null,
  turnTimerHandle: null,
  knownTrickPlayCount: 0, // 這一輪已經畫過幾手，只有新增的那幾手才會有進場動畫
};

function hideAll(elements) {
  elements.forEach((e) => {
    e.hidden = true;
  });
}

const ALL_SCREENS = [el.noGameScreen, el.lobbyScreen, el.tableScreen, el.finishedScreen];

function showMessage(text) {
  el.message.textContent = text;
  el.message.hidden = false;
  hideAll(ALL_SCREENS);
  stopPolling();
  stopTurnTimer();
}

function showToast(text) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  el.toast.style.animation = "none";
  // eslint-disable-next-line no-unused-expressions
  el.toast.offsetHeight;
  el.toast.style.animation = "";
  clearTimeout(showToast._hideTimer);
  showToast._hideTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 1800);
}

function isMyTurn() {
  const game = state.game;
  return !!game && game.phase === "PLAYING" && game.mySeatIndex !== null && game.mySeatIndex === game.currentTurnSeat;
}

function cardParts(code) {
  const rank = code[0] === "T" ? "10" : code[0];
  return { rank, suit: SUIT_SYMBOLS[code[1]], red: RED_SUITS.has(code[1]) };
}

function renderCardEl(code, selectable) {
  const { rank, suit, red } = cardParts(code);
  const cardEl = document.createElement(selectable ? "button" : "div");
  cardEl.className = "card" + (red ? " red" : "");
  cardEl.innerHTML = `<span class="card-rank">${rank}</span><span class="card-suit">${suit}</span>`;
  return cardEl;
}

function seatLabel(seat) {
  if (seat.isBot) return `🤖 ${seat.displayName}`;
  if (seat.displayName === null) return "空位";
  return seat.isSelf ? `${seat.displayName}（你）` : seat.displayName;
}

function toggleSelect(code) {
  if (!isMyTurn()) return;
  if (state.selected.has(code)) state.selected.delete(code);
  else state.selected.add(code);
  renderTable(state.game);
}

function renderHand(game) {
  const mySeat = game.seats.find((s) => s.isSelf);
  const hand = mySeat && mySeat.hand ? mySeat.hand : [];
  el.handArea.innerHTML = "";
  const selectable = isMyTurn();
  hand.forEach((code) => {
    const cardEl = renderCardEl(code, true);
    if (state.selected.has(code)) cardEl.classList.add("selected");
    if (!selectable) cardEl.disabled = true;
    cardEl.addEventListener("click", () => toggleSelect(code));
    el.handArea.appendChild(cardEl);
  });
}

function renderLobby(game) {
  el.lobbySeats.innerHTML = "";
  game.seats.forEach((seat) => {
    const row = document.createElement("div");
    row.className = "lobby-seat" + (seat.displayName === null ? " empty" : "");
    row.textContent = seat.seatIndex === 0 && seat.displayName !== null ? `👑 ${seatLabel(seat)}` : seatLabel(seat);
    el.lobbySeats.appendChild(row);
  });

  const iAmSeated = game.mySeatIndex !== null;
  const lobbyFull = game.seats.every((s) => s.displayName !== null);
  el.joinRow.hidden = iAmSeated || lobbyFull;

  el.hostControls.hidden = !game.isHost;
  el.botCount.textContent = game.botCount;
  el.waitingText.hidden = game.isHost;
}

/**
 * currentTrick.plays 是「這一輪從有人領牌到現在」所有人依序出過的牌，不是只有最後一手——
 * 連續兩隻機器人接力出牌時，兩手都要攤在桌上，不能只看到最後一隻機器人出的牌。
 * state.knownTrickPlayCount 記著上次畫面畫到第幾手，只有新增的那幾手才會有進場動畫，
 * 避免每次輪詢（就算牌桌沒變化）都讓整排卡片重新彈跳一次。
 */
function renderTrick(game, mine) {
  if (!game.currentTrick) {
    el.trickLabel.textContent = mine ? "由你自由開牌" : "等待重新開牌";
    el.trickPlays.innerHTML = "";
    state.knownTrickPlayCount = 0;
    return;
  }

  const plays = game.currentTrick.plays;
  el.trickLabel.textContent = "本輪出牌";
  el.trickPlays.innerHTML = "";
  plays.forEach((play, index) => {
    const seat = game.seats.find((s) => s.seatIndex === play.seatIndex);
    const row = document.createElement("div");
    row.className = "trick-play";
    if (index === plays.length - 1) row.classList.add("current-best");
    if (index >= state.knownTrickPlayCount) row.classList.add("just-played");

    const nameEl = document.createElement("span");
    nameEl.className = "trick-play-name";
    nameEl.textContent = seat ? seatLabel(seat) : "";

    const cardsEl = document.createElement("div");
    cardsEl.className = "trick-play-cards";
    play.cards.forEach((code) => cardsEl.appendChild(renderCardEl(code, false)));

    row.appendChild(nameEl);
    row.appendChild(cardsEl);
    el.trickPlays.appendChild(row);
  });
  state.knownTrickPlayCount = plays.length;
}

function renderTable(game) {
  el.seatStrip.innerHTML = "";
  game.seats.forEach((seat) => {
    const chip = document.createElement("div");
    chip.className = "seat-chip";
    if (seat.seatIndex === game.currentTurnSeat) chip.classList.add("active-turn");
    if (seat.finishRank) chip.classList.add("finished");
    chip.innerHTML = `<span class="seat-name">${seatLabel(seat)}</span><span class="seat-count">🂠 ${seat.handCount}</span>`;
    el.seatStrip.appendChild(chip);
  });

  const mine = isMyTurn();
  const turnSeat = game.seats.find((s) => s.seatIndex === game.currentTurnSeat);
  el.turnBanner.textContent = mine ? "🎯 輪到你了！" : `等待 ${turnSeat ? seatLabel(turnSeat) : "…"} 出牌`;
  el.turnBanner.classList.toggle("my-turn", mine);

  renderTrick(game, mine);
  renderHand(game);

  el.passButton.hidden = !game.currentTrick;
  el.playButton.disabled = !mine || state.selected.size === 0;
  el.passButton.disabled = !mine;

  startTurnTimer(game.turnDeadlineAt);
}

function renderFinished(game) {
  el.finishedRanks.innerHTML = "";
  const ranked = [...game.seats].filter((s) => s.finishRank).sort((a, b) => a.finishRank - b.finishRank);
  ranked.forEach((seat) => {
    const row = document.createElement("div");
    row.className = "finished-row" + (seat.isSelf ? " self" : "");
    row.textContent = `${RANK_MEDALS[seat.finishRank - 1] ?? seat.finishRank} ${seatLabel(seat)}`;
    el.finishedRanks.appendChild(row);
  });
}

function renderAll() {
  el.message.hidden = true;
  const game = state.game;

  if (!game) {
    hideAll(ALL_SCREENS);
    el.noGameScreen.hidden = false;
    stopTurnTimer();
    return;
  }

  if (game.phase === "LOBBY") {
    renderLobby(game);
    hideAll(ALL_SCREENS);
    el.lobbyScreen.hidden = false;
    stopTurnTimer();
    return;
  }

  if (game.phase === "PLAYING") {
    renderTable(game);
    hideAll(ALL_SCREENS);
    el.tableScreen.hidden = false;
    return;
  }

  renderFinished(game);
  hideAll(ALL_SCREENS);
  el.finishedScreen.hidden = false;
  stopTurnTimer();
}

function stopTurnTimer() {
  if (state.turnTimerHandle) {
    clearInterval(state.turnTimerHandle);
    state.turnTimerHandle = null;
  }
}

function startTurnTimer(turnDeadlineAt) {
  stopTurnTimer();
  if (!turnDeadlineAt) {
    el.timerBar.hidden = true;
    return;
  }
  el.timerBar.hidden = false;
  const deadlineMs = new Date(turnDeadlineAt).getTime();

  function tick() {
    const remainingMs = Math.max(0, deadlineMs - Date.now());
    const fraction = remainingMs / TURN_TIME_LIMIT_MS;
    el.timerFill.style.width = `${Math.round(Math.min(1, fraction) * 100)}%`;
    el.timerBar.classList.toggle("critical", fraction <= 0.25);
    if (remainingMs <= 0) {
      stopTurnTimer();
      // client 端倒數只是視覺，真正判定一律以後端為準——時間到了就重新拉一次狀態，
      // 讓後端的懶惰結算/懶惰接管把這回合處理掉
      pollState();
    }
  }

  tick();
  state.turnTimerHandle = setInterval(tick, 200);
}

function applyState(body) {
  state.game = body.game || null;
}

async function pollState() {
  if (!state.groupId || !state.idToken) return;
  try {
    const res = await fetch(`${API_BASE}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: state.idToken, groupId: state.groupId }),
    });
    const body = await res.json();
    if (!res.ok) {
      showMessage("身分驗證失敗，請關閉頁面重新從群組按鈕打開");
      return;
    }
    applyState(body);
    renderAll();
  } catch (err) {
    // 輪詢失敗就靜默重試，不要每 1.8 秒跳一次錯誤訊息干擾畫面
  }
}

function stopPolling() {
  if (state.pollHandle) {
    clearInterval(state.pollHandle);
    state.pollHandle = null;
  }
}

function startPolling() {
  stopPolling();
  state.pollHandle = setInterval(() => {
    if (document.hidden) return;
    pollState();
  }, POLL_INTERVAL_MS);
}

async function postAction(path, extraBody) {
  if (state.acting) return { ok: false, error: "busy" };
  state.acting = true;
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: state.idToken, groupId: state.groupId, ...extraBody }),
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: body.error };
    }
    applyState(body);
    renderAll();
    return { ok: true };
  } catch (err) {
    showMessage("網路好像怪怪的，稍後再試一次？");
    return { ok: false, error: "network" };
  } finally {
    state.acting = false;
  }
}

function adjustBotCount(delta) {
  if (!state.game || !state.game.isHost) return;
  const next = Math.max(0, Math.min(3, state.game.botCount + delta));
  postAction("configure", { botCount: next });
}

async function handlePlay() {
  if (state.selected.size === 0) {
    showToast("先選要出的牌");
    return;
  }
  const cards = [...state.selected];
  state.selected.clear();
  const result = await postAction("play", { cards });
  if (!result.ok && result.error !== "busy") {
    showToast("這樣出不合法喔");
  }
}

async function handlePass() {
  const result = await postAction("pass");
  if (!result.ok && result.error !== "busy") {
    showToast("現在不能跳過喔");
  }
}

/**
 * LINE 平台從 2023 年 2 月起不再讓 liff.getContext() 拿到真正的群組 ID（改回傳一個
 * 跟 Messaging API 對不上的內部替代值），所以群組 ID 改成由後端在產生 party 選單時
 * （見 src/line/partyMenu.ts）夾帶進 LIFF 網址的 query string，這裡從網址讀出來。
 * LIFF 導頁有時會把額外的 query string 包進 liff.state 而不是直接留在網址上，
 * 兩個都檢查一次才夠保險。
 */
function getGroupIdFromUrl() {
  const direct = new URLSearchParams(location.search).get("groupId");
  if (direct) return direct;

  if (liff.state) {
    try {
      const stateUrl = new URL(liff.state, location.origin);
      const fromState = stateUrl.searchParams.get("groupId");
      if (fromState) return fromState;
    } catch (err) {
      // liff.state 不是預期的 URL 格式，忽略
    }
  }

  return null;
}

async function init() {
  let liffId;
  try {
    const configRes = await fetch(`${API_BASE}/config`);
    const config = await configRes.json();
    liffId = config.liffId;
  } catch (err) {
    showMessage("連不上伺服器，請稍後再試");
    return;
  }

  if (!liffId) {
    showMessage("這個功能還沒設定好，請聯絡管理員");
    return;
  }

  try {
    await liff.init({ liffId });
  } catch (err) {
    showMessage("LIFF 初始化失敗，請確認是從 LINE 開啟這個頁面");
    return;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
    return; // liff.login() 會導頁，接下來的程式碼不會執行到
  }

  const context = liff.getContext();
  if (!context || context.type !== "group") {
    showMessage("請從群組聊天室裡的「🃏 大老二對戰」按鈕開啟這個遊戲");
    return;
  }

  const groupId = getGroupIdFromUrl();
  if (!groupId) {
    showMessage("找不到群組資訊，請回群組重新輸入「party」取得最新的按鈕再開啟一次");
    return;
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    showMessage("無法取得身分資訊，請關閉頁面重新開啟");
    return;
  }

  state.groupId = groupId;
  state.idToken = idToken;
  el.subtitle.textContent = "跟大家湊一桌，開打！";

  await pollState();
  startPolling();
}

el.createButton.addEventListener("click", () => postAction("create"));
el.joinButton.addEventListener("click", () => postAction("join"));
el.botMinus.addEventListener("click", () => adjustBotCount(-1));
el.botPlus.addEventListener("click", () => adjustBotCount(1));
el.startButton.addEventListener("click", () => postAction("start"));
el.playButton.addEventListener("click", handlePlay);
el.passButton.addEventListener("click", handlePass);
el.playAgainButton.addEventListener("click", () => postAction("create"));
el.helpButton.addEventListener("click", showTutorial);
el.tutorialClose.addEventListener("click", hideTutorial);

if (!hasSeenTutorial()) {
  showTutorial();
}

init();
