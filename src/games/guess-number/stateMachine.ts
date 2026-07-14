/**
 * 終極密碼純狀態機 — 無 I/O、無副作用，方便單元測試。
 */

export interface GuessNumberConfig {
  min: number;
  max: number;
}

export interface GuessNumberState extends Record<string, unknown> {
  answer: number;
  min: number;
  max: number;
  lowerBound: number;
  upperBound: number;
  attempts: number;
  guessesByMember: Record<string, number>;
}

export type GuessOutcome =
  | { type: "win"; attempts: number }
  | { type: "too_low"; lowerBound: number; upperBound: number }
  | { type: "too_high"; lowerBound: number; upperBound: number }
  | { type: "out_of_range"; lowerBound: number; upperBound: number };

export const DEFAULT_CONFIG: GuessNumberConfig = { min: 1, max: 100 };

export function createState(config: GuessNumberConfig, answer?: number): GuessNumberState {
  const resolvedAnswer =
    answer ?? Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
  if (resolvedAnswer < config.min || resolvedAnswer > config.max) {
    throw new Error(`answer ${resolvedAnswer} out of range ${config.min}~${config.max}`);
  }
  return {
    answer: resolvedAnswer,
    min: config.min,
    max: config.max,
    lowerBound: config.min,
    upperBound: config.max,
    attempts: 0,
    guessesByMember: {},
  };
}

export function applyGuess(
  state: GuessNumberState,
  memberId: string,
  guess: number,
): { state: GuessNumberState; outcome: GuessOutcome } {
  if (guess < state.lowerBound || guess > state.upperBound) {
    return {
      state,
      outcome: { type: "out_of_range", lowerBound: state.lowerBound, upperBound: state.upperBound },
    };
  }

  const guessesByMember = {
    ...state.guessesByMember,
    [memberId]: (state.guessesByMember[memberId] ?? 0) + 1,
  };
  const attempts = state.attempts + 1;

  if (guess === state.answer) {
    return {
      state: { ...state, attempts, guessesByMember },
      outcome: { type: "win", attempts },
    };
  }

  if (guess < state.answer) {
    const lowerBound = guess + 1;
    return {
      state: { ...state, attempts, guessesByMember, lowerBound },
      outcome: { type: "too_low", lowerBound, upperBound: state.upperBound },
    };
  }

  const upperBound = guess - 1;
  return {
    state: { ...state, attempts, guessesByMember, upperBound },
    outcome: { type: "too_high", lowerBound: state.lowerBound, upperBound },
  };
}

/** 解析群組訊息是否為一次猜測（純數字，允許前後空白） */
export function parseGuess(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,7}$/.test(trimmed)) return null;
  return Number(trimmed);
}
