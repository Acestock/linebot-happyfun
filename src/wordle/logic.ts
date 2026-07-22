/**
 * Wordle 純邏輯（無 I/O）— 字母回饋演算法、單字庫、有效猜測判斷。
 * 跟 src/meetup/stats.ts / schedule.ts 同樣的角色：manager.ts 負責 DB，這裡只做資料運算。
 */

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5;

export type LetterFeedback = "correct" | "present" | "absent";

/**
 * 常見英文 5 字母單字庫，同時當作「有效答案」與「有效猜測」的來源（v1 先用單一詞庫，
 * 不做經典 Wordle 那種「答案庫較小、猜測庫較大」的兩份清單，先求簡單能上線）。
 */
export const WORD_LIST: string[] = [
  "ABOUT", "ABOVE", "ABUSE", "ACTOR", "ACUTE", "ADMIT", "ADOPT", "ADULT", "AFTER", "AGAIN",
  "AGENT", "AGREE", "AHEAD", "ALARM", "ALBUM", "ALERT", "ALIEN", "ALIGN", "ALIKE", "ALIVE",
  "ALLOW", "ALONE", "ALONG", "ALTER", "AMONG", "ANGER", "ANGLE", "ANGRY", "ANKLE", "APART",
  "APPLE", "APPLY", "ARENA", "ARGUE", "ARISE", "ARMOR", "ARRAY", "ARROW", "ASIDE", "ASSET",
  "AUDIO", "AUDIT", "AVOID", "AWAKE", "AWARD", "AWARE", "BADLY", "BAKER", "BASIC", "BASIS",
  "BEACH", "BEGAN", "BEGIN", "BEGUN", "BEING", "BELOW", "BENCH", "BIRTH", "BLACK", "BLAME",
  "BLANK", "BLAST", "BLIND", "BLOCK", "BLOOD", "BOARD", "BOOST", "BOOTH", "BOUND", "BRAIN",
  "BRAND", "BREAD", "BREAK", "BREED", "BRIEF", "BRING", "BROAD", "BROKE", "BROWN", "BUILD",
  "BUILT", "BUYER", "CABLE", "CANDY", "CARRY", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHALK",
  "CHAOS", "CHARM", "CHART", "CHASE", "CHEAP", "CHECK", "CHEST", "CHIEF", "CHILD", "CHINA",
  "CHOSE", "CIVIL", "CLAIM", "CLASS", "CLEAN", "CLEAR", "CLICK", "CLIMB", "CLOCK", "CLOSE",
  "CLOUD", "COACH", "COAST", "COULD", "COUNT", "COURT", "COVER", "CRAFT", "CRASH", "CRAZY",
  "CRANE", "CREAM", "CRIME", "CROSS", "CROWD", "CROWN", "CRUDE", "CURVE", "CYCLE", "DAILY", "DAIRY",
  "DANCE", "DEALT", "DEATH", "DEBUT", "DELAY", "DEPTH", "DOUBT", "DOZEN", "DRAFT", "DRAMA",
  "DRANK", "DRAWN", "DREAM", "DRESS", "DRIED", "DRILL", "DRINK", "DRIVE", "DROVE", "EAGER",
  "EARLY", "EARTH", "EIGHT", "ELITE", "EMPTY", "ENEMY", "ENJOY", "ENTER", "ENTRY", "EQUAL",
  "ERROR", "EVENT", "EVERY", "EXACT", "EXIST", "EXTRA", "FAITH", "FALSE", "FAULT", "FAVOR",
  "FENCE", "FIBER", "FIELD", "FIFTH", "FIFTY", "FIGHT", "FINAL", "FIRST", "FIXED", "FLASH",
  "FLEET", "FLOOR", "FLUID", "FOCUS", "FORCE", "FORTH", "FORTY", "FORUM", "FOUND", "FRAME",
  "FRANK", "FRAUD", "FRESH", "FRONT", "FROST", "FRUIT", "FULLY", "FUNNY", "GHOST", "GIANT",
  "GIVEN", "GLASS", "GLOBE", "GLORY", "GRACE", "GRADE", "GRAND", "GRANT", "GRASS", "GREAT",
  "GREEN", "GROSS", "GROUP", "GROWN", "GUARD", "GUESS", "GUEST", "GUIDE", "HAPPY", "HARSH",
  "HEART", "HEAVY", "HELLO", "HENCE", "HONEY", "HONOR", "HORSE", "HOTEL", "HOUSE", "HUMAN",
  "IDEAL", "IMAGE", "IMPLY", "INDEX", "INNER", "INPUT", "ISSUE", "JOINT", "JUDGE", "JUICE",
  "KNIFE", "KNOWN", "LABEL", "LARGE", "LASER", "LATER", "LAUGH", "LAYER", "LEARN", "LEAST",
  "LEAVE", "LEGAL", "LEMON", "LEVEL", "LIGHT", "LIMIT", "LOCAL", "LOGIC", "LOOSE", "LOWER",
  "LOYAL", "LUCKY", "LUNCH", "MAGIC", "MAJOR", "MAKER", "MARCH", "MATCH", "MAYOR", "MEANT",
  "MEDAL", "MEDIA", "MERIT", "METAL", "MIGHT", "MINOR", "MINUS", "MIXED", "MODEL", "MONEY",
  "MONTH", "MORAL", "MOTOR", "MOUNT", "MOUSE", "MOUTH", "MOVIE", "MUSIC", "NERVE", "NEVER",
  "NEWLY", "NIGHT", "NOISE", "NORTH", "NOTED", "NOVEL", "NURSE", "OCCUR", "OCEAN", "OFFER",
  "OFTEN", "ORDER", "OTHER", "OUTER", "OWNER", "PAINT", "PANEL", "PANIC", "PAPER", "PARTY",
  "PATCH", "PEACE", "PHASE", "PHONE", "PHOTO", "PIANO", "PIECE", "PILOT", "PITCH", "PLACE",
  "PLAIN", "PLANE", "PLANT", "PLATE", "POINT", "POUND", "POWER", "PRESS", "PRICE", "PRIDE",
  "PRIME", "PRINT", "PRIOR", "PRIZE", "PROOF", "PROUD", "PROVE", "QUEEN", "QUERY", "QUICK",
  "QUIET", "QUITE", "RADIO", "RAISE", "RANGE", "RAPID", "RATIO", "REACH", "READY", "REALM",
  "REBEL", "REFER", "RELAX", "REPLY", "RIDGE", "RIGHT", "RIVAL", "RIVER", "ROBOT", "ROMAN",
  "ROUGH", "ROUND", "ROUTE", "ROYAL", "RURAL", "SALAD", "SAUCE", "SCALE", "SCENE", "SCOPE",
  "SCORE", "SENSE", "SERVE", "SEVEN", "SHADE", "SHAKE", "SHALL", "SHAPE", "SHARE", "SHARP",
  "SHEEP", "SHEET", "SHELF", "SHELL", "SHIFT", "SHINE", "SHIRT", "SHOCK", "SHOOT", "SHORT",
  "SHOWN", "SIGHT", "SILLY", "SINCE", "SIXTH", "SIXTY", "SKILL", "SLEEP", "SLIDE", "SMALL",
  "SMART", "SMELL", "SMILE", "SMOKE", "SNAKE", "SOLID", "SOLVE", "SORRY", "SOUND", "SOUTH",
  "SPACE", "SPARE", "SPEAK", "SPEED", "SPEND", "SPENT", "SPLIT", "SPOKE", "SPORT", "STAFF",
  "STAGE", "STAKE", "STAND", "START", "STATE", "STEAM", "STEEL", "STEEP", "STICK", "STIFF",
  "STILL", "STOCK", "STONE", "STOOD", "STORE", "STORM", "STORY", "STRIP", "STUCK", "STUDY",
  "STUFF", "STYLE", "SUGAR", "SUPER", "SWEET", "TABLE", "TAKEN", "TASTE", "TEACH", "THANK",
  "THEFT", "THEIR", "THEME", "THERE", "THESE", "THICK", "THING", "THINK", "THIRD", "THOSE",
  "THREE", "THREW", "THROW", "TIGHT", "TIMES", "TIRED", "TITLE", "TODAY", "TOPIC", "TOTAL",
  "TOUCH", "TOUGH", "TOWER", "TRACK", "TRADE", "TRAIL", "TRAIN", "TREAT", "TREND", "TRIAL",
  "TRIBE", "TRICK", "TRIED", "TRUCK", "TRULY", "TRUNK", "TRUST", "TRUTH", "TWICE", "UNDER",
  "UNION", "UNITY", "UNTIL", "UPPER", "UPSET", "URBAN", "USAGE", "USUAL", "VALID", "VALUE",
  "VIDEO", "VIRUS", "VISIT", "VITAL", "VOICE", "WASTE", "WATCH", "WATER", "WHEEL", "WHERE",
  "WHICH", "WHILE", "WHITE", "WHOLE", "WHOSE", "WOMAN", "WOMEN", "WORLD", "WORRY", "WORSE",
  "WORST", "WORTH", "WOULD", "WOUND", "WRITE", "WRONG", "WROTE", "YIELD", "YOUNG", "YOUTH",
];

const WORD_SET: Set<string> = new Set(WORD_LIST);

export function isValidGuess(guess: string): boolean {
  return WORD_SET.has(guess.toUpperCase());
}

/**
 * 經典 Wordle 兩輪演算法：第一輪先標記完全命中的字母（位置+字母都對），
 * 第二輪才處理「字母對但位置錯」，並且要扣掉第一輪已經用掉的字母數量，
 * 這樣重複字母（例如猜 SPEED、答案 ERASE）才不會被錯誤標記成兩個 present。
 */
export function computeFeedback(answer: string, guess: string): LetterFeedback[] {
  const answerLetters = answer.toUpperCase().split("");
  const guessLetters = guess.toUpperCase().split("");
  const feedback: LetterFeedback[] = new Array(guessLetters.length).fill("absent");

  const remaining: Record<string, number> = {};
  for (let i = 0; i < answerLetters.length; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      feedback[i] = "correct";
    } else {
      remaining[answerLetters[i]] = (remaining[answerLetters[i]] ?? 0) + 1;
    }
  }

  for (let i = 0; i < guessLetters.length; i++) {
    if (feedback[i] === "correct") continue;
    const letter = guessLetters[i];
    if ((remaining[letter] ?? 0) > 0) {
      feedback[i] = "present";
      remaining[letter] -= 1;
    }
  }

  return feedback;
}

export function isWin(feedback: LetterFeedback[]): boolean {
  return feedback.every((f) => f === "correct");
}

/**
 * 每個人可以當天連續開很多題，題目不再是「全群組共用同一天同一題」，所以不需要日期
 * determinism 了——單純隨機挑一個，避開這個人最近玩過的幾題（題庫不夠大、用不完的話
 * 就允許重複，不會卡住）。
 */
export function pickRoundWord(recentAnswers: string[]): string {
  const avoidSet = new Set(recentAnswers.map((w) => w.toUpperCase()));
  const candidates = WORD_LIST.filter((w) => !avoidSet.has(w));
  const pool = candidates.length > 0 ? candidates : WORD_LIST;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 猜越少次分數越高，最後一次猜中封底分（不會是 0，至少有基礎鼓勵分）。跟 speedBonus／
 * comboMultiplier（src/shared/gameScoring.ts）疊加算出最終 roundScore。
 */
export function baseScoreForGuesses(guessesUsed: number): number {
  return Math.max(25, 100 - (guessesUsed - 1) * 15);
}
