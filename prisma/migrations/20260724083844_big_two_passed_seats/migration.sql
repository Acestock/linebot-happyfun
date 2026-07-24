/*
  Warnings:

  - You are about to drop the column `pass_count` on the `big_two_games` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "big_two_games" DROP COLUMN "pass_count",
ADD COLUMN     "passed_seats" JSONB NOT NULL DEFAULT '[]';
