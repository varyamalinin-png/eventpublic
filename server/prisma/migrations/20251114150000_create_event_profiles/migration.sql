-- CreateTable
CREATE TABLE IF NOT EXISTS "EventProfile" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT,
    "avatar" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventProfilePost" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventProfilePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventProfileParticipant" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventProfileParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserFolder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserFolderUser" (
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFolderUser_pkey" PRIMARY KEY ("folderId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventProfile_eventId_key" ON "EventProfile"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventProfileParticipant_profileId_userId_key" ON "EventProfileParticipant"("profileId", "userId");

-- AddForeignKey (без IF NOT EXISTS, так как PostgreSQL не поддерживает это в ALTER TABLE)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EventProfile_eventId_fkey'
    ) THEN
        ALTER TABLE "EventProfile" ADD CONSTRAINT "EventProfile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EventProfilePost_profileId_fkey'
    ) THEN
        ALTER TABLE "EventProfilePost" ADD CONSTRAINT "EventProfilePost_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "EventProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EventProfilePost_authorId_fkey'
    ) THEN
        ALTER TABLE "EventProfilePost" ADD CONSTRAINT "EventProfilePost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EventProfileParticipant_profileId_fkey'
    ) THEN
        ALTER TABLE "EventProfileParticipant" ADD CONSTRAINT "EventProfileParticipant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "EventProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EventProfileParticipant_userId_fkey'
    ) THEN
        ALTER TABLE "EventProfileParticipant" ADD CONSTRAINT "EventProfileParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserFolder_ownerId_fkey'
    ) THEN
        ALTER TABLE "UserFolder" ADD CONSTRAINT "UserFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserFolderUser_folderId_fkey'
    ) THEN
        ALTER TABLE "UserFolderUser" ADD CONSTRAINT "UserFolderUser_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "UserFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserFolderUser_userId_fkey'
    ) THEN
        ALTER TABLE "UserFolderUser" ADD CONSTRAINT "UserFolderUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

