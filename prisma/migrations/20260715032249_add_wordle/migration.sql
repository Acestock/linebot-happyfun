-- CreateTable
CREATE TABLE "wordle_puzzles" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wordle_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordle_attempts" (
    "id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "guesses" JSONB NOT NULL DEFAULT '[]',
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wordle_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wordle_puzzles_date_key" ON "wordle_puzzles"("date");

-- CreateIndex
CREATE INDEX "wordle_attempts_puzzle_id_group_id_idx" ON "wordle_attempts"("puzzle_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "wordle_attempts_puzzle_id_member_id_key" ON "wordle_attempts"("puzzle_id", "member_id");

-- AddForeignKey
ALTER TABLE "wordle_attempts" ADD CONSTRAINT "wordle_attempts_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "wordle_puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordle_attempts" ADD CONSTRAINT "wordle_attempts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordle_attempts" ADD CONSTRAINT "wordle_attempts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

