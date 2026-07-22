/*
  Warnings:

  - You are about to drop the `one_a_two_b_attempts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `one_a_two_b_puzzles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wordle_attempts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wordle_puzzles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "one_a_two_b_attempts" DROP CONSTRAINT "one_a_two_b_attempts_group_id_fkey";

-- DropForeignKey
ALTER TABLE "one_a_two_b_attempts" DROP CONSTRAINT "one_a_two_b_attempts_member_id_fkey";

-- DropForeignKey
ALTER TABLE "one_a_two_b_attempts" DROP CONSTRAINT "one_a_two_b_attempts_puzzle_id_fkey";

-- DropForeignKey
ALTER TABLE "wordle_attempts" DROP CONSTRAINT "wordle_attempts_group_id_fkey";

-- DropForeignKey
ALTER TABLE "wordle_attempts" DROP CONSTRAINT "wordle_attempts_member_id_fkey";

-- DropForeignKey
ALTER TABLE "wordle_attempts" DROP CONSTRAINT "wordle_attempts_puzzle_id_fkey";

-- DropTable
DROP TABLE "one_a_two_b_attempts";

-- DropTable
DROP TABLE "one_a_two_b_puzzles";

-- DropTable
DROP TABLE "wordle_attempts";

-- DropTable
DROP TABLE "wordle_puzzles";

-- CreateTable
CREATE TABLE "wordle_rounds" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "round_index" INTEGER NOT NULL,
    "streak_position" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "guesses" JSONB NOT NULL DEFAULT '[]',
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "timed_out" BOOLEAN NOT NULL DEFAULT false,
    "time_limit_seconds" INTEGER NOT NULL,
    "guess_deadline_at" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,

    CONSTRAINT "wordle_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordle_daily_stats" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "rounds_played" INTEGER NOT NULL DEFAULT 0,
    "rounds_solved" INTEGER NOT NULL DEFAULT 0,
    "best_score" INTEGER NOT NULL DEFAULT 0,
    "current_combo" INTEGER NOT NULL DEFAULT 0,
    "best_combo" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wordle_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_a_two_b_rounds" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "round_index" INTEGER NOT NULL,
    "streak_position" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "guesses" JSONB NOT NULL DEFAULT '[]',
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "timed_out" BOOLEAN NOT NULL DEFAULT false,
    "time_limit_seconds" INTEGER NOT NULL,
    "guess_deadline_at" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,

    CONSTRAINT "one_a_two_b_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_a_two_b_daily_stats" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "rounds_played" INTEGER NOT NULL DEFAULT 0,
    "rounds_solved" INTEGER NOT NULL DEFAULT 0,
    "best_score" INTEGER NOT NULL DEFAULT 0,
    "current_combo" INTEGER NOT NULL DEFAULT 0,
    "best_combo" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_a_two_b_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wordle_rounds_group_id_date_idx" ON "wordle_rounds"("group_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "wordle_rounds_group_id_member_id_date_round_index_key" ON "wordle_rounds"("group_id", "member_id", "date", "round_index");

-- CreateIndex
CREATE INDEX "wordle_daily_stats_group_id_date_idx" ON "wordle_daily_stats"("group_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "wordle_daily_stats_group_id_member_id_date_key" ON "wordle_daily_stats"("group_id", "member_id", "date");

-- CreateIndex
CREATE INDEX "one_a_two_b_rounds_group_id_date_idx" ON "one_a_two_b_rounds"("group_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "one_a_two_b_rounds_group_id_member_id_date_round_index_key" ON "one_a_two_b_rounds"("group_id", "member_id", "date", "round_index");

-- CreateIndex
CREATE INDEX "one_a_two_b_daily_stats_group_id_date_idx" ON "one_a_two_b_daily_stats"("group_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "one_a_two_b_daily_stats_group_id_member_id_date_key" ON "one_a_two_b_daily_stats"("group_id", "member_id", "date");

-- AddForeignKey
ALTER TABLE "wordle_rounds" ADD CONSTRAINT "wordle_rounds_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordle_rounds" ADD CONSTRAINT "wordle_rounds_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordle_daily_stats" ADD CONSTRAINT "wordle_daily_stats_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordle_daily_stats" ADD CONSTRAINT "wordle_daily_stats_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_a_two_b_rounds" ADD CONSTRAINT "one_a_two_b_rounds_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_a_two_b_rounds" ADD CONSTRAINT "one_a_two_b_rounds_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_a_two_b_daily_stats" ADD CONSTRAINT "one_a_two_b_daily_stats_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_a_two_b_daily_stats" ADD CONSTRAINT "one_a_two_b_daily_stats_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
