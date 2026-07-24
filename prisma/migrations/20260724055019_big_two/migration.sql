-- CreateEnum
CREATE TYPE "BigTwoPhase" AS ENUM ('LOBBY', 'PLAYING', 'FINISHED');

-- CreateTable
CREATE TABLE "big_two_games" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "host_member_id" TEXT NOT NULL,
    "phase" "BigTwoPhase" NOT NULL DEFAULT 'LOBBY',
    "bot_count" INTEGER NOT NULL DEFAULT 0,
    "current_turn_seat" INTEGER,
    "current_trick" JSONB,
    "pass_count" INTEGER NOT NULL DEFAULT 0,
    "turn_deadline_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "big_two_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "big_two_seats" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "seat_index" INTEGER NOT NULL,
    "member_id" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "bot_name" TEXT,
    "hand" JSONB NOT NULL DEFAULT '[]',
    "finish_rank" INTEGER,

    CONSTRAINT "big_two_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "big_two_daily_stats" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "best_rank" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "big_two_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "big_two_games_group_id_idx" ON "big_two_games"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "big_two_seats_game_id_seat_index_key" ON "big_two_seats"("game_id", "seat_index");

-- CreateIndex
CREATE INDEX "big_two_daily_stats_group_id_date_idx" ON "big_two_daily_stats"("group_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "big_two_daily_stats_group_id_member_id_date_key" ON "big_two_daily_stats"("group_id", "member_id", "date");

-- AddForeignKey
ALTER TABLE "big_two_games" ADD CONSTRAINT "big_two_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "big_two_games" ADD CONSTRAINT "big_two_games_host_member_id_fkey" FOREIGN KEY ("host_member_id") REFERENCES "group_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "big_two_seats" ADD CONSTRAINT "big_two_seats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "big_two_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "big_two_seats" ADD CONSTRAINT "big_two_seats_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "big_two_daily_stats" ADD CONSTRAINT "big_two_daily_stats_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "big_two_daily_stats" ADD CONSTRAINT "big_two_daily_stats_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
