import type { GameDefinition } from "./types";
import { guessNumberGame } from "../guess-number";
import { topicChatGame } from "../topic-chat";

const games: GameDefinition[] = [guessNumberGame, topicChatGame];

export function listGames(): GameDefinition[] {
  return games;
}

export function getGame(gameType: string): GameDefinition | undefined {
  return games.find((g) => g.gameType === gameType);
}
