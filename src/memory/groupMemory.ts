import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";

const MAX_SNIPPETS = 5;

/**
 * 取出要塞進 system prompt 的群組記憶片段。
 * 表目前主要由遊戲結果慢慢累積，讀取失敗一律回空陣列，不影響文案生成。
 */
export async function getMemorySnippets(groupId: string): Promise<string[]> {
  try {
    const memories = await prisma.groupMemory.findMany({
      where: { groupId },
      orderBy: [{ weight: "desc" }, { updatedAt: "desc" }],
      take: MAX_SNIPPETS,
    });
    return memories.map((m) => {
      const value = typeof m.value === "string" ? m.value : JSON.stringify(m.value);
      return `${m.key}：${value}`;
    });
  } catch (err) {
    logger.warn({ err, groupId }, "failed to load group memory snippets");
    return [];
  }
}

/** 記錄/更新一則群組記憶（upsert；weight 高的會優先進 prompt） */
export async function rememberFact(
  groupId: string,
  memoryType: string,
  key: string,
  value: unknown,
  weight = 1.0,
): Promise<void> {
  try {
    await prisma.groupMemory.upsert({
      where: { groupId_memoryType_key: { groupId, memoryType, key } },
      create: { groupId, memoryType, key, value: value as never, weight },
      update: { value: value as never, weight },
    });
  } catch (err) {
    logger.warn({ err, groupId, memoryType, key }, "failed to store group memory");
  }
}
