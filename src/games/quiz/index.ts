import { createRoundsGame } from "../shared/roundsGameFactory";
import { QUIZ_FALLBACK_BANK } from "./fallbackBank";

const ROUND_COUNT = 5;

export const quizGame = createRoundsGame({
  gameType: "quiz",
  displayName: "機智問答",
  emoji: "🧠",
  shortDescription: `AI 即時出 ${ROUND_COUNT} 題冷知識搶答，答對最多的人獲勝！`,
  roundCount: ROUND_COUNT,
  openingIntro: "AI 已經準備好一組全新題目，考驗大家的知識廣度～",
  generationPrompt:
    "請出台灣人熟悉的一般知識搶答題，難度中等偏易，答案要簡短明確。",
  categoryPool: [
    "地理",
    "歷史",
    "科學/科普",
    "生活常識",
    "流行文化/影劇",
    "運動",
    "美食",
    "動物",
    "音樂",
    "科技/3C",
    "節慶習俗",
    "數學/邏輯",
  ],
  fallbackBank: QUIZ_FALLBACK_BANK,
  formatQuestion: (question, roundNumber, total) =>
    `📝 第 ${roundNumber}/${total} 題：${question}`,
});
