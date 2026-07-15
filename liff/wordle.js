// 每日 Wordle — 純 vanilla JS，沒有建構工具，直接被 index.html 當一般 <script> 載入。
// LIFF SDK 透過 CDN <script> 載入，這裡就直接用全域的 `liff` 物件。

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

const el = {
  subtitle: document.getElementById("subtitle"),
  message: document.getElementById("message"),
  grid: document.getElementById("grid"),
  keyboard: document.getElementById("keyboard"),
  finish: document.getElementById("finish"),
  finishText: document.getElementById("finish-text"),
  shareButton: document.getElementById("share-button"),
};

const state = {
  groupId: null,
  idToken: null,
  rows: [], // [{ guess, feedback: ["correct"|"present"|"absent", ...] }]
  guessesRemaining: MAX_GUESSES,
  solved: false,
  puzzleDate: null,
  currentInput: [],
  keyStatus: {}, // letter -> "correct" | "present" | "absent"
  submitting: false,
};

function showMessage(text) {
  el.message.textContent = text;
  el.message.hidden = false;
  el.grid.hidden = true;
  el.keyboard.hidden = true;
  el.finish.hidden = true;
}

function betterStatus(a, b) {
  const rank = { correct: 3, present: 2, absent: 1 };
  return (rank[b] || 0) > (rank[a] || 0) ? b : a;
}

function recomputeKeyStatus() {
  state.keyStatus = {};
  for (const row of state.rows) {
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
  state.rows.forEach((row, r) => {
    row.guess.split("").forEach((letter, c) => {
      const tile = document.getElementById(`tile-${r}-${c}`);
      tile.textContent = letter;
      tile.classList.add(row.feedback[c]);
    });
  });
}

function renderCurrentInputRow() {
  const r = state.rows.length;
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

  if (state.currentInput.length < WORD_LENGTH) {
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
  recomputeKeyStatus();
}

function renderAll() {
  renderSubmittedRows();
  renderCurrentInputRow();
  updateKeyboardColors();

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
  return `🔤 每日 Wordle ${state.puzzleDate || ""} ${guessCount}/${MAX_GUESSES}\n\n${emojiRows}`;
}

function showFinish() {
  el.finishText.textContent = state.solved
    ? `🎉 猜對了！用了 ${state.rows.length} 次\n輸入「wordle 排行」到群組看排行榜`
    : `😢 這次沒猜出來，答案下次公布在排行榜\n輸入「wordle 排行」到群組看看大家的成績`;
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
  el.message.hidden = true;
  el.grid.hidden = false;
  buildGrid();
  renderAll();
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

// 桌機瀏覽器測試用：支援實體鍵盤輸入（LIFF 在外部瀏覽器開啟時沒有群組context，
// 但畫面/輸入邏輯本身還是可以這樣驗證）
document.addEventListener("keydown", (e) => {
  if (el.keyboard.hidden) return;
  if (e.key === "Enter") handleKey("ENTER");
  else if (e.key === "Backspace") handleKey("BACK");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
});

init();
