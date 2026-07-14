-- CreateEnum
CREATE TYPE "MeetupPhase" AS ENUM ('SETUP', 'READY', 'OPENING', 'CHECKIN', 'ICEBREAKER', 'INTERACTION', 'FREE_TALK', 'CLOSING', 'ENDED', 'PAUSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "meetups" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "host_member_id" TEXT NOT NULL,
    "phase" "MeetupPhase" NOT NULL DEFAULT 'SETUP',
    "paused_from_phase" "MeetupPhase",
    "name" TEXT,
    "planned_minutes" INTEGER,
    "host_style" TEXT,
    "icebreaker_category" TEXT,
    "interaction_type" TEXT,
    "custom_icebreaker_text" TEXT,
    "setup_step" TEXT,
    "current_icebreaker" TEXT,
    "used_icebreakers" JSONB NOT NULL DEFAULT '[]',
    "current_interaction" TEXT,
    "used_interactions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "meetups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetup_checkins" (
    "id" TEXT NOT NULL,
    "meetup_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "text" TEXT,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetup_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetup_feedback" (
    "id" TEXT NOT NULL,
    "meetup_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meetup_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetups_group_id_phase_idx" ON "meetups"("group_id", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "meetup_checkins_meetup_id_member_id_key" ON "meetup_checkins"("meetup_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "meetup_feedback_meetup_id_member_id_key" ON "meetup_feedback"("meetup_id", "member_id");

-- AddForeignKey
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_host_member_id_fkey" FOREIGN KEY ("host_member_id") REFERENCES "group_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetup_checkins" ADD CONSTRAINT "meetup_checkins_meetup_id_fkey" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetup_checkins" ADD CONSTRAINT "meetup_checkins_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetup_feedback" ADD CONSTRAINT "meetup_feedback_meetup_id_fkey" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetup_feedback" ADD CONSTRAINT "meetup_feedback_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

