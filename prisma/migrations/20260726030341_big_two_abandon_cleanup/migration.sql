-- AlterEnum
ALTER TYPE "BigTwoPhase" ADD VALUE 'CANCELLED';

-- AlterTable
-- 這裡一定要給 DEFAULT：正式環境的 big_two_games 早就有真人測玩留下的資料列，
-- Postgres 沒辦法在既有資料列上補一個沒有預設值的 NOT NULL 欄位（會直接報錯整個
-- migration 卡住，回滾也不會清掉錯誤紀錄）。之後每一筆更新都是 Prisma 的
-- `@updatedAt` 在應用層自動維護，這個 DB 端的預設值只是負責幫舊資料列補值。
ALTER TABLE "big_two_games" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
