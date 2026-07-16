// 每日 1A2B — 純 vanilla JS，沒有建構工具，直接被 index.html 當一般 <script> 載入。
// LIFF SDK 透過 CDN <script> 載入，這裡就直接用全域的 `liff` 物件。
// 架構跟 liff/wordle/wordle.js 幾乎一樣，只是字母格改成數字格、虛擬鍵盤改成數字鍵。

const DIGITS = 4;
const MAX_GUESSES = 10;
const API_BASE = "/api/one-a-two-b";

const el = {
  subtitle: document.getElementById("subtitle"),
  message: document.getElementById("message"),
  grid: document.getElementById("grid"),
  keyboard: document.getElementById("keyboard"),
  finish: document.getElementById("finish"),
  finishText: document.getElementById("finish-text"),
  shareButton: document.getElementById("share-button"),
  helpButton: document.getElementById("help-button"),
  tutorial: document.getElementById("tutorial"),
  tutorialClose: document.getElementById("tutorial-close"),
};

const TUTORIAL_SEEN_KEY = "one_a_two_b_tutorial_seen";

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
  rows: [], // [{ guess, feedback: ["correct"|"present"|"absent", ...] }]
  guessesRemaining: MAX_GUESSES,
  solved: false,
  puzzleDate: null,
  currentInput: [],
  submitting: false,
};

function showMessage(text) {
  el.message.textContent = text;
  el.message.hidden = false;
  el.grid.hidden = true;
  el.keyboard.hidden = true;
  el.finish.hidden = true;
}

function buildGrid() {
  el.grid.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.id = `row-${r}`;
    for (let c = 0; c < DIGITS; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${r}-${c}`;
      rowEl.appendChild(tile);
    }
    el.grid.appendChild(rowEl);
  }
}

function renderSubmittedRows() {
  state.rows.forEach((row, r) => {
    row.guess.split("").forEach((digit, c) => {
      const tile = document.getElementById(`tile-${r}-${c}`);
      tile.textContent = digit;
      tile.classList.add(row.feedback[c]);
    });
  });
}

function renderCurrentInputRow() {
  const r = state.rows.length;
  if (r >= MAX_GUESSES) return;
  for (let c = 0; c < DIGITS; c++) {
    const tile = document.getElementById(`tile-${r}-${c}`);
    tile.textContent = state.currentInput[c] || "";
    tile.classList.remove("correct", "present", "absent");
  }
}

// 數字鍵盤（不像 Wordle 需要依猜測歷史標色，1A2B 傳統玩法只看格子回饋，鍵盤純輸入用）
const KEYPAD_ROWS = ["12345", "67890"];

function buildKeyboard() {
  el.keyboard.innerHTML = "";
  KEYPAD_ROWS.forEach((digits) => {
    const rowEl = document.createElement("div");
    rowEl.className = "keyboard-row";
    for (const digit of digits) {
      rowEl.appendChild(makeKey(digit));
    }
    el.keyboard.appendChild(rowEl);
  });

  const actionRow = document.createElement("div");
  actionRow.className = "keyboard-row";
  actionRow.appendChild(makeKey("BACK", "wide"));
  actionRow.appendChild(makeKey("ENTER", "wide"));
  el.keyboard.appendChild(actionRow);
}

function makeKey(label, extraClass) {
  const btn = document.createElement("button");
  btn.className = "key" + (extraClass ? ` ${extraClass}` : "");
  btn.textContent = label === "BACK" ? "⌫" : label === "ENTER" ? "確認" : label;
  btn.dataset.key = label;
  btn.addEventListener("click", () => handleKey(label));
  return btn;
}

function handleKey(key) {
  if (state.submitting || state.solved || state.guessesRemaining <= 0) return;

  if (key === "BACK") {
    state.currentInput.pop();
    renderCurrentInputRow();
    return;
  }

  if (key === "ENTER") {
    submitCurrentGuess();
    return;
  }

  if (state.currentInput.length < DIGITS) {
    state.currentInput.push(key);
    renderCurrentInputRow();
  }
}

function shakeCurrentRow() {
  const r = state.rows.length;
  const rowEl = document.getElementById(`row-${r}`);
  if (!rowEl) return;
  rowEl.querySelectorAll(".tile").forEach((t) => {
    t.classList.add("shake");
    setTimeout(() => t.classList.remove("shake"), 300);
  });
}

async function submitCurrentGuess() {
  if (state.currentInput.length !== DIGITS) {
    shakeCurrentRow();
    return;
  }

  const guess = state.currentInput.join("");
  state.submitting = true;
  try {
    const res = await fetch(`${API_BASE}/guess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: state.idToken, groupId: state.groupId, guess }),
    });
    const body = await res.json();

    if (!res.ok) {
      if (body.error === "invalid_guess") {
        shakeCurrentRow();
      } else if (body.error === "already_finished") {
        // 狀態跟後端不同步了（例如另一個分頁已經玩完），重新整理狀態
        await loadSession();
      }
      return;
    }

    applyState(body);
    state.currentInput = [];
    renderAll();
  } catch (err) {
    showMessage("網路好像怪怪的，稍後再試一次？");
  } finally {
    state.submitting = false;
  }
}

function applyState(body) {
  state.rows = body.rows || [];
  state.guessesRemaining = body.guessesRemaining;
  state.solved = body.solved;
  state.puzzleDate = body.puzzleDate;
}

function renderAll() {
  renderSubmittedRows();
  renderCurrentInputRow();

  const finished = state.solved || state.guessesRemaining <= 0;
  el.keyboard.hidden = finished;
  el.finish.hidden = !finished;

  if (finished) {
    showFinish();
  }
}

function buildShareText() {
  const guessCount = state.solved ? state.rows.length : "X";
  const emojiRows = state.rows
    .map((row) =>
      row.feedback
        .map((f) => (f === "correct" ? "🟩" : f === "present" ? "🟨" : "⬜"))
        .join(""),
    )
    .join("\n");
  return `🔐 每日 1A2B ${state.puzzleDate || ""} ${guessCount}/${MAX_GUESSES}\n\n${emojiRows}`;
}

function showFinish() {
  el.finishText.textContent = state.solved
    ? `🎉 猜對了！用了 ${state.rows.length} 次\n輸入「1a2b 排行」到群組看排行榜`
    : `😢 這次沒猜出來，答案下次公布在排行榜\n輸入「1a2b 排行」到群組看看大家的成績`;
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

async function loadSession() {
  const res = await fetch(`${API_BASE}/session`, {
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
  el.message.hidden = true;
  el.grid.hidden = false;
  buildGrid();
  buildKeyboard();
  renderAll();
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
    showMessage("請從群組聊天室裡的「🔐 每日 1A2B」按鈕開啟這個遊戲");
    return;
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    showMessage("無法取得身分資訊，請關閉頁面重新開啟");
    return;
  }

  state.groupId = context.groupId;
  state.idToken = idToken;

  await loadSession();
}

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
  else if (/^[0-9]$/.test(e.key)) handleKey(e.key);
});

init();
