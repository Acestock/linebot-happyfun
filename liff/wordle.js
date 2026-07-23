// 每日 Wordle — 純 vanilla JS，沒有建構工具，直接被 index.html 當一般 <script> 載入。
// LIFF SDK 透過 CDN <script> 載入，這裡就直接用全域的 `liff` 物件。

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const CONFETTI_EMOJI = ["🎉", "✨", "🟩", "🎊", "⭐"];

const el = {
  subtitle: document.getElementById("subtitle"),
  message: document.getElementById("message"),
  startScreen: document.getElementById("start-screen"),
  startText: document.getElementById("start-text"),
  startButton: document.getElementById("start-button"),
  timerBar: document.getElementById("timer-bar"),
  timerFill: document.getElementById("timer-fill"),
  timerLabel: document.getElementById("timer-label"),
  grid: document.getElementById("grid"),
  keyboard: document.getElementById("keyboard"),
  roundResult: document.getElementById("round-result"),
  roundResultText: document.getElementById("round-result-text"),
  scoreBreakdown: document.getElementById("score-breakdown"),
  nextRoundButton: document.getElementById("next-round-button"),
  shareButton: document.getElementById("share-button"),
  helpButton: document.getElementById("help-button"),
  tutorial: document.getElementById("tutorial"),
  tutorialClose: document.getElementById("tutorial-close"),
  hud: document.getElementById("hud"),
  hudCombo: document.getElementById("hud-combo"),
  hudBest: document.getElementById("hud-best"),
  toast: document.getElementById("toast"),
};

const TUTORIAL_SEEN_KEY = "wordle_tutorial_seen";

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
  round: null, // RoundView | null（null = 今天還沒開第一題）
  dailyStats: null,
  currentInput: [],
  keyStatus: {}, // letter -> "correct" | "present" | "absent"
  submitting: false,
  timerHandle: null,
};

function showMessage(text) {
  el.message.textContent = text;
  el.message.hidden = false;
  el.startScreen.hidden = true;
  el.timerBar.hidden = true;
  el.grid.hidden = true;
  el.keyboard.hidden = true;
  el.roundResult.hidden = true;
  el.hud.hidden = true;
}

function showToast(text) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  // 重新觸發 CSS 動畫：先移除再加回 class 才能連續觸發同一個 toast
  el.toast.style.animation = "none";
  // eslint-disable-next-line no-unused-expressions
  el.toast.offsetHeight;
  el.toast.style.animation = "";
  clearTimeout(showToast._hideTimer);
  showToast._hideTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 1800);
}

function spawnConfetti() {
  const count = 18;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.textContent = CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.animationDuration = `${1.2 + Math.random() * 1}s`;
    piece.style.fontSize = `${0.9 + Math.random() * 0.8}rem`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2400);
  }
}

function betterStatus(a, b) {
  const rank = { correct: 3, present: 2, absent: 1 };
  return (rank[b] || 0) > (rank[a] || 0) ? b : a;
}

function recomputeKeyStatus() {
  state.keyStatus = {};
  if (!state.round) return;
  for (const row of state.round.rows) {
    row.guess.split("").forEach((letter, i) => {
      const current = state.keyStatus[letter];
      state.keyStatus[letter] = current ? betterStatus(current, row.feedback[i]) : row.feedback[i];
    });
  }
}

function buildGrid() {
  el.grid.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.id = `row-${r}`;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${r}-${c}`;
      rowEl.appendChild(tile);
    }
    el.grid.appendChild(rowEl);
  }
}

function renderSubmittedRows() {
  state.round.rows.forEach((row, r) => {
    row.guess.split("").forEach((letter, c) => {
      const tile = document.getElementById(`tile-${r}-${c}`);
      if (!tile) return;
      tile.textContent = letter;
      tile.classList.add(row.feedback[c]);
    });
  });
}

function renderCurrentInputRow() {
  const r = state.round.rows.length;
  if (r >= MAX_GUESSES) return;
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = document.getElementById(`tile-${r}-${c}`);
    tile.textContent = state.currentInput[c] || "";
    tile.classList.remove("correct", "present", "absent");
  }
}

function buildKeyboard() {
  el.keyboard.innerHTML = "";
  KEYBOARD_ROWS.forEach((letters, i) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";

    if (i === 2) rowEl.appendChild(makeKey("ENTER", "wide"));
    for (const letter of letters) {
      rowEl.appendChild(makeKey(letter));
    }
    if (i === 2) rowEl.appendChild(makeKey("BACK", "wide"));

    el.keyboard.appendChild(rowEl);
  });
  updateKeyboardColors();
}

function makeKey(label, extraClass) {
  const btn = document.createElement("button");
  btn.className = "key" + (extraClass ? ` ${extraClass}` : "");
  btn.textContent = label === "BACK" ? "⌫" : label === "ENTER" ? "確認" : label;
  btn.dataset.key = label;
  btn.addEventListener("click", () => handleKey(label));
  return btn;
}

function updateKeyboardColors() {
  document.querySelectorAll(".key").forEach((btn) => {
    const key = btn.dataset.key;
    btn.classList.remove("correct", "present", "absent");
    const status = state.keyStatus[key];
    if (status) btn.classList.add(status);
  });
}

function handleKey(key) {
  if (state.submitting || !state.round || state.round.finished) return;

  if (key === "BACK") {
    state.currentInput.pop();
    renderCurrentInputRow();
    return;
  }

  if (key === "ENTER") {
    submitCurrentGuess();
    return;
  }

  if (state.currentInput.length < WORD_LENGTH) {
    state.currentInput.push(key);
    renderCurrentInputRow();
  }
}

function shakeCurrentRow() {
  const r = state.round.rows.length;
  const rowEl = document.getElementById(`row-${r}`);
  if (!rowEl) return;
  rowEl.querySelectorAll(".tile").forEach((t) => {
    t.classList.add("shake");
    setTimeout(() => t.classList.remove("shake"), 300);
  });
}

async function submitCurrentGuess() {
  if (state.currentInput.length !== WORD_LENGTH) {
    shakeCurrentRow();
    return;
  }

  const guess = state.currentInput.join("");
  state.submitting = true;
  try {
    const res = await fetch("/api/wordle/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: state.idToken, groupId: state.groupId, guess }),
    });
    const body = await res.json();

    if (!res.ok) {
      if (body.error === "invalid_word") {
        shakeCurrentRow();
      } else if (body.error === "already_finished" || body.error === "no_active_round") {
        // 狀態跟後端不同步了（例如超時被懶惰結算，或另一分頁已經玩完），重新整理狀態
        await loadSession();
      }
      return;
    }

    const wasCombo = state.dailyStats ? state.dailyStats.currentCombo : 0;
    applyState(body);
    state.currentInput = [];
    renderAll();

    if (state.round.solved) {
      spawnConfetti();
      showToast(`+${state.round.score} 分！`);
      if (state.dailyStats.currentCombo > wasCombo && state.dailyStats.currentCombo >= 2) {
        setTimeout(() => showToast(`🔥 連續 ${state.dailyStats.currentCombo} 題！`), 900);
      }
    } else if (state.round.finished) {
      showToast("連續紀錄中斷");
    }
  } catch (err) {
    showMessage("網路好像怪怪的，稍後再試一次？");
  } finally {
    state.submitting = false;
  }
}

function applyState(body) {
  state.round = body.round || null;
  state.dailyStats = body.dailyStats || state.dailyStats;
  recomputeKeyStatus();
}

function updateHud() {
  if (!state.dailyStats) {
    el.hud.hidden = true;
    return;
  }
  el.hud.hidden = false;
  el.hudCombo.textContent = state.dailyStats.currentCombo;
  el.hudBest.textContent = state.dailyStats.bestScore;
}

function stopTimer() {
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
}

function startTimer(guessDeadlineAt, timeLimitSeconds) {
  stopTimer();
  const deadlineMs = new Date(guessDeadlineAt).getTime();
  const totalMs = timeLimitSeconds * 1000;

  function tick() {
    const remainingMs = Math.max(0, deadlineMs - Date.now());
    const fraction = totalMs > 0 ? remainingMs / totalMs : 0;
    el.timerFill.style.width = `${Math.round(fraction * 100)}%`;
    el.timerLabel.textContent = Math.ceil(remainingMs / 1000);
    el.timerBar.classList.toggle("low", fraction <= 0.4 && fraction > 0.2);
    el.timerBar.classList.toggle("critical", fraction <= 0.2);

    if (remainingMs <= 0) {
      stopTimer();
      // client 端倒數只是視覺，真正判定一律以後端為準——時間到了就重新整理狀態，
      // 讓後端的懶惰結算把這回合判定掉
      loadSession();
    }
  }

  tick();
  state.timerHandle = setInterval(tick, 200);
}

function renderRoundResult() {
  const round = state.round;
  if (round.solved) {
    el.roundResultText.textContent = `🎉 猜對了！用了 ${round.rows.length} 次\n＋${round.score} 分`;
    if (round.scoreBreakdown) {
      const b = round.scoreBreakdown;
      el.scoreBreakdown.textContent = `基礎 ${b.base} 分 + 手速加成 ${b.speedBonus} 分，× 連擊倍率 ${b.multiplier.toFixed(2)}`;
      el.scoreBreakdown.hidden = false;
    } else {
      el.scoreBreakdown.hidden = true;
    }
    el.nextRoundButton.textContent = "🎯 挑戰下一題";
  } else {
    el.roundResultText.textContent = round.timedOut
      ? "⏰ 時間到，這回合失敗了\n連續紀錄重置"
      : "😢 這次沒猜出來，連續紀錄重置";
    el.scoreBreakdown.hidden = true;
    el.nextRoundButton.textContent = "🔁 重新開始";
  }
}

function buildShareText() {
  const round = state.round;
  if (!round) return "";
  const resultLabel = round.solved ? `${round.rows.length}/${MAX_GUESSES}` : "X";
  const emojiRows = round.rows
    .map((row) => row.feedback.map((f) => (f === "correct" ? "🟩" : f === "present" ? "🟨" : "⬜")).join(""))
    .join("\n");
  const scoreLine = round.solved ? `本題 +${round.score} 分（連擊 x${state.dailyStats.currentCombo}）` : "";
  return `🔤 每日 Wordle ${resultLabel}\n${scoreLine}\n\n${emojiRows}`.trim();
}

async function shareResult() {
  const text = buildShareText();
  try {
    if (liff.isApiAvailable && liff.isApiAvailable("shareTargetPicker")) {
      await liff.shareTargetPicker([{ type: "text", text }]);
    } else {
      showMessage("這個版本的 LINE 不支援分享功能，成績已經幫你記錄在群組排行榜囉！");
    }
  } catch (err) {
    // 使用者取消分享或分享失敗都不用特別處理
  }
}

function renderAll() {
  updateHud();
  el.message.hidden = true;

  if (!state.round) {
    stopTimer();
    el.startScreen.hidden = false;
    el.timerBar.hidden = true;
    el.grid.hidden = true;
    el.keyboard.hidden = true;
    el.roundResult.hidden = true;
    const solvedToday = state.dailyStats ? state.dailyStats.roundsSolved : 0;
    el.startText.textContent =
      solvedToday > 0
        ? `今天已經解出 ${solvedToday} 題，最高 ${state.dailyStats.bestScore} 分！\n準備好挑戰下一題了嗎？`
        : "準備好了嗎？解開一題可以馬上挑戰下一題，\n連續答對分數越疊越高，但時間會越來越緊張！";
    return;
  }

  el.startScreen.hidden = true;
  el.grid.hidden = false;
  buildGrid();
  renderSubmittedRows();

  if (!state.round.finished) {
    renderCurrentInputRow();
    buildKeyboard();
    el.timerBar.hidden = false;
    el.keyboard.hidden = false;
    el.roundResult.hidden = true;
    startTimer(state.round.guessDeadlineAt, state.round.timeLimitSeconds);
  } else {
    stopTimer();
    el.timerBar.hidden = true;
    el.keyboard.hidden = true;
    el.roundResult.hidden = false;
    renderRoundResult();
  }
}

async function requestNextRound() {
  try {
    const res = await fetch("/api/wordle/next-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: state.idToken, groupId: state.groupId }),
    });
    const body = await res.json();
    if (!res.ok) {
      // 409 round_in_progress：跟後端狀態不同步，重新載入就好
      await loadSession();
      return;
    }
    applyState(body);
    state.currentInput = [];
    renderAll();
  } catch (err) {
    showMessage("網路好像怪怪的，稍後再試一次？");
  }
}

async function loadSession() {
  const res = await fetch("/api/wordle/session", {
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
  el.subtitle.textContent = body.displayName ? `${body.displayName}，開始挑戰吧！` : "開始挑戰吧！";
  renderAll();
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
    const configRes = await fetch("/api/wordle/config");
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
    showMessage("請從群組聊天室裡的「🔤 每日 Wordle」按鈕開啟這個遊戲");
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

  await loadSession();
}

el.startButton.addEventListener("click", requestNextRound);
el.nextRoundButton.addEventListener("click", requestNextRound);
el.shareButton.addEventListener("click", shareResult);
el.helpButton.addEventListener("click", showTutorial);
el.tutorialClose.addEventListener("click", hideTutorial);

// 說明彈窗是純靜態內容，不用等 LIFF/API 都載入完成，第一次進來就先彈一次
if (!hasSeenTutorial()) {
  showTutorial();
}

// 桌機瀏覽器測試用：支援實體鍵盤輸入（LIFF 在外部瀏覽器開啟時沒有群組context，
// 但畫面/輸入邏輯本身還是可以這樣驗證）
document.addEventListener("keydown", (e) => {
  if (el.keyboard.hidden || !el.tutorial.hidden) return;
  if (e.key === "Enter") handleKey("ENTER");
  else if (e.key === "Backspace") handleKey("BACK");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
});

init();
