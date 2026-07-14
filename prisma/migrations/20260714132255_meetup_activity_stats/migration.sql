-- AlterTable
ALTER TABLE "meetups" ADD COLUMN     "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "message_counts" JSONB NOT NULL DEFAULT '{}';

