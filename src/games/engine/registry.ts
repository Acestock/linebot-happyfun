import type { GameDefinition } from "./types";
import { guessNumberGame } from "../guess-number";
import { topicChatGame } from "../topic-chat";
import { quizGame } from "../quiz";
import { emojiRiddleGame } from "../emoji-riddle";
import { wordChainGame } from "../word-chain";

const games: GameDefinition[] = [
  guessNumberGame,
  quizGame,
  emojiRiddleGame,
  wordChainGame,
  topicChatGame,
];

export function listGames(): GameDefinition[] {
  return games;
}

export function getGame(gameType: string): GameDefinition | undefined {
  return games.find((g) => g.gameType === gameType);
}
