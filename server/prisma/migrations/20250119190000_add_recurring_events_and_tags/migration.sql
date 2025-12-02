-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "recurringType" TEXT,
ADD COLUMN IF NOT EXISTS "recurringDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN IF NOT EXISTS "recurringDayOfMonth" INTEGER,
ADD COLUMN IF NOT EXISTS "recurringCustomDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
ADD COLUMN IF NOT EXISTS "autoTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "customTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "ageRestriction" JSONB,
ADD COLUMN IF NOT EXISTS "genderRestriction" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "mediaType" TEXT,
ADD COLUMN IF NOT EXISTS "mediaAspectRatio" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "targeting" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_isRecurring_idx" ON "Event"("isRecurring");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_autoTags_idx" ON "Event"("autoTags");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_customTags_idx" ON "Event"("customTags");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_recurringCustomDates_idx" ON "Event"("recurringCustomDates");

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserEventParticipation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participationDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "UserEventParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserEventParticipation_userId_eventId_key" ON "UserEventParticipation"("userId", "eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserEventParticipation_userId_idx" ON "UserEventParticipation"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserEventParticipation_eventId_idx" ON "UserEventParticipation"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserEventParticipation_participationDates_idx" ON "UserEventParticipation"("participationDates");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserEventParticipation_status_idx" ON "UserEventParticipation"("status");

-- AddForeignKey
ALTER TABLE "UserEventParticipation" ADD CONSTRAINT "UserEventParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEventParticipation" ADD CONSTRAINT "UserEventParticipation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

