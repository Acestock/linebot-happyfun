import type { GameDefinition } from "./types";
import { guessNumberGame } from "../guess-number";

const games: GameDefinition[] = [guessNumberGame];

export function listGames(): GameDefinition[] {
  return games;
}

export function getGame(gameType: string): GameDefinition | undefined {
  return games.find((g) => g.gameType === gameType);
}
