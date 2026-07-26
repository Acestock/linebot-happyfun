/*
  Warnings:

  - Added the required column `updated_at` to the `big_two_games` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "BigTwoPhase" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "big_two_games" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
