/**
 * 通用遊戲模組介面 — 新遊戲（狼人殺、讀書會…）只要實作 GameDefinition
 * 並在 registry 註冊，不需要動 session manager 或 webhook。
 * 狀態一律是可 JSON 序列化的物件，存放於 Redis。
 */

export type GameState = Record<string, unknown>;

import type { CopyIntent } from "../../persona/types";

export interface MoveResult {
  nextState: GameState;
  /** 確定性的回覆文字；null 表示保持沉默。有 aiContext 時作為 LLM 失敗的 fallback */
  replyText: string | null;
  finished: boolean;
  /** DB member id of the winner, only when finished */
  winnerMemberId?: string;
  /** whether this move should be persisted to game_moves */
  recordMove: boolean;
  movePayload?: Record<string, unknown>;
  moveOutcome?: Record<string, unknown>;
  /** 提供時，session manager 會用 LLM 以此情境改寫 replyText（人設文案） */
  aiContext?: Record<string, unknown>;
  /** aiContext 對應的文案意圖；未指定且 finished 時預設 "result" */
  aiIntent?: CopyIntent;
}

export interface MoveContext {
  memberId: string;
  memberName: string | null;
}

export interface InitialState {
  state: GameState;
  openingText: string;
  config: Record<string, unknown>;
  aiContext?: Record<string, unknown>;
  aiIntent?: CopyIntent;
}

export interface GameDefinition {
  gameType: string;
  displayName: string;
  emoji: string;
  shortDescription: string;

  /**
   * 開一局：回傳初始狀態與開場文案（openingText 同時是 LLM 的 fallback）。
   * 可以是 async——例如需要先用 LLM 生成整組題目再開局的遊戲。
   * groupId 讓遊戲能記住「這個群組最近出過什麼」，避免重複出題。
   */
  createInitialState(groupId: string): InitialState | Promise<InitialState>;

  /** 嘗試把一則群組訊息解析成本遊戲的操作；不是操作就回 null（保持沉默） */
  parseMove(text: string): Record<string, unknown> | null;

  /** 套用一步操作 */
  applyMove(state: GameState, move: Record<string, unknown>, ctx: MoveContext): MoveResult;

  /** 中途取消時的收場文案 */
  cancelText(state: GameState): string;

  /** 進行中被重複開局時的提示文案 */
  inProgressText(state: GameState): string;
}
