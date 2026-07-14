/**
 * 多回合搶答遊戲的共用純邏輯（機智問答、Emoji 猜謎…）。
 * 題目在開局時一次備妥（AI 生成或題庫），遊戲進行中判題零 LLM 呼叫。
 */

export interface Round {
  question: string;
  /** 可接受的答案寫法（第一個視為標準答案，用於公布） */
  answers: string[];
  hint?: string;
}

export interface RoundsState extends Record<string, unknown> {
  rounds: Round[];
  idx: number;
  /** 每人答對題數（沿用 guessesByMember 欄位名以共用結算邏輯） */
  guessesByMember: Record<string, number>;
  /** memberId -> 顯示名稱（做計分板用） */
  namesById: Record<string, string>;
}

/** 全形轉半形、去空白標點、轉小寫，讓「鐵達尼號」「鐵達尼 號」等寫法都算對 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

export function isCorrectAnswer(guess: string, round: Round): boolean {
  const g = normalizeAnswer(guess);
  if (g.length === 0) return false;
  return round.answers.some((answer) => {
    const a = normalizeAnswer(answer);
    if (a.length === 0) return false;
    if (g === a) return true;
    // 長度 >= 2 時允許包含式比對（「鐵達尼」可對「鐵達尼號」）
    if (g.length >= 2 && (a.includes(g) || g.includes(a))) return true;
    return false;
  });
}

export function createRoundsState(rounds: Round[]): RoundsState {
  return { rounds, idx: 0, guessesByMember: {}, namesById: {} };
}

export function currentRound(state: RoundsState): Round {
  return state.rounds[state.idx];
}

export type RoundOutcome =
  | { type: "correct"; answer: string; finished: boolean; nextQuestion?: string }
  | { type: "wrong" }
  | { type: "skipped"; answer: string; finished: boolean; nextQuestion?: string };

export function applyRoundGuess(
  state: RoundsState,
  memberId: string,
  memberName: string | null,
  guess: string,
): { state: RoundsState; outcome: RoundOutcome } {
  const round = currentRound(state);
  const namesById = memberName
    ? { ...state.namesById, [memberId]: memberName }
    : state.namesById;

  if (!isCorrectAnswer(guess, round)) {
    return { state: { ...state, namesById }, outcome: { type: "wrong" } };
  }

  const guessesByMember = {
    ...state.guessesByMember,
    [memberId]: (state.guessesByMember[memberId] ?? 0) + 1,
  };
  const idx = state.idx + 1;
  const finished = idx >= state.rounds.length;

  return {
    state: { ...state, idx, guessesByMember, namesById },
    outcome: {
      type: "correct",
      answer: round.answers[0],
      finished,
      nextQuestion: finished ? undefined : state.rounds[idx].question,
    },
  };
}

export function skipRound(state: RoundsState): { state: RoundsState; outcome: RoundOutcome } {
  const round = currentRound(state);
  const idx = state.idx + 1;
  const finished = idx >= state.rounds.length;
  return {
    state: { ...state, idx },
    outcome: {
      type: "skipped",
      answer: round.answers[0],
      finished,
      nextQuestion: finished ? undefined : state.rounds[idx].question,
    },
  };
}

export function buildLeaderboard(
  scoresByMember: Record<string, number>,
  namesById: Record<string, string>,
  unit = "分",
): { text: string; winnerId: string | null } {
  const entries = Object.entries(scoresByMember).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { text: "這場沒有人得分😅", winnerId: null };
  const lines = entries.map(([id, score], i) => {
    const medal = ["🥇", "🥈", "🥉"][i] ?? "🏅";
    return `${medal} ${namesById[id] ?? "神祕玩家"}：${score} ${unit}`;
  });
  return { text: lines.join("\n"), winnerId: entries[0][0] };
}

export function buildScoreboard(state: RoundsState): { text: string; winnerId: string | null } {
  return buildLeaderboard(state.guessesByMember, state.namesById);
}
