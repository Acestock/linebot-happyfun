import { createRoundsGame } from "../shared/roundsGameFactory";
import { EMOJI_FALLBACK_BANK } from "./fallbackBank";

const ROUND_COUNT = 5;

export const emojiRiddleGame = createRoundsGame({
  gameType: "emoji_riddle",
  displayName: "Emoji 猜謎",
  emoji: "🎬",
  shortDescription: `看 emoji 猜電影/歌曲/成語，AI 出 ${ROUND_COUNT} 題，反應快的人贏！`,
  roundCount: ROUND_COUNT,
  openingIntro: "AI 已經把答案藏進一串 emoji 裡了，眼睛放亮！",
  generationPrompt:
    "請用純 emoji（不要文字）組合成謎題，讓玩家猜出對應的知名電影片名、歌曲名或成語/俗語，" +
    "每題 3~5 個 emoji，question 欄位只放 emoji 不要放任何文字提示。",
  categoryPool: ["知名電影", "動畫/卡通電影", "華語流行歌曲", "英文流行歌曲", "成語", "俗語/諺語", "電視劇/影集"],
  fallbackBank: EMOJI_FALLBACK_BANK,
  formatQuestion: (question, roundNumber, total) => `🔍 第 ${roundNumber}/${total} 題：${question}`,
});
