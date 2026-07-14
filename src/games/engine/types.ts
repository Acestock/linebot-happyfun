/**
 * 通用遊戲模組介面 — 新遊戲（狼人殺、讀書會…）只要實作 GameDefinition
 * 並在 registry 註冊，不需要動 session manager 或 webhook。
 * 狀態一律是可 JSON 序列化的物件，存放於 Redis。
 */

export type GameState = Record<string, unknown>;

export interface MoveResult {
  nextState: GameState;
  replyText: string;
  finished: boolean;
  /** DB member id of the winner, only when finished */
  winnerMemberId?: string;
  /** whether this move should be persisted to game_moves */
  recordMove: boolean;
  movePayload?: Record<string, unknown>;
  moveOutcome?: Record<string, unknown>;
}

export interface GameDefinition {
  gameType: string;
  displayName: string;
  emoji: string;
  shortDescription: string;

  /** 開一局：回傳初始狀態與開場文案 */
  createInitialState(): { state: GameState; openingText: string; config: Record<string, unknown> };

  /** 嘗試把一則群組訊息解析成本遊戲的操作；不是操作就回 null（保持沉默） */
  parseMove(text: string): Record<string, unknown> | null;

  /** 套用一步操作 */
  applyMove(state: GameState, move: Record<string, unknown>, ctx: { memberId: string }): MoveResult;

  /** 中途取消時的收場文案 */
  cancelText(state: GameState): string;

  /** 進行中被重複開局時的提示文案 */
  inProgressText(state: GameState): string;
}
