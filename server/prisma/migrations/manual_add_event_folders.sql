-- CreateTable
CREATE TABLE IF NOT EXISTS "EventFolder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventFolderEvent" (
    "folderId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFolderEvent_pkey" PRIMARY KEY ("folderId","eventId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventFolder_ownerId_idx" ON "EventFolder"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventFolderEvent_folderId_idx" ON "EventFolderEvent"("folderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventFolderEvent_eventId_idx" ON "EventFolderEvent"("eventId");

-- AddForeignKey
ALTER TABLE "EventFolder" ADD CONSTRAINT "EventFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFolderEvent" ADD CONSTRAINT "EventFolderEvent_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "EventFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFolderEvent" ADD CONSTRAINT "EventFolderEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
