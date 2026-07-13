-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('pending', 'active', 'finished', 'cancelled', 'timeout');

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "line_group_id" TEXT NOT NULL,
    "display_name" TEXT,
    "persona_style" TEXT NOT NULL DEFAULT 'energetic_roast',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "memory_cleared_at" TIMESTAMP(3),

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_interacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memory" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'pending',
    "config" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "winner_member_id" TEXT,
    "started_by_member_id" TEXT,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_participants" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rank" INTEGER,
    "guesses_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_moves" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "move_index" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "groups_line_group_id_key" ON "groups"("line_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_line_user_id_key" ON "group_members"("group_id", "line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_memory_group_id_memory_type_key_key" ON "group_memory"("group_id", "memory_type", "key");

-- CreateIndex
CREATE INDEX "game_sessions_group_id_status_idx" ON "game_sessions"("group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "game_participants_session_id_member_id_key" ON "game_participants"("session_id", "member_id");

-- CreateIndex
CREATE INDEX "game_moves_session_id_idx" ON "game_moves"("session_id");

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memory" ADD CONSTRAINT "group_memory_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_winner_member_id_fkey" FOREIGN KEY ("winner_member_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_started_by_member_id_fkey" FOREIGN KEY ("started_by_member_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

