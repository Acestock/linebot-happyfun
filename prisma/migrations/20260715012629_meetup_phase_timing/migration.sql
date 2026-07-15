-- AlterTable
ALTER TABLE "meetups" ADD COLUMN     "phase_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phase_started_at" TIMESTAMP(3);
