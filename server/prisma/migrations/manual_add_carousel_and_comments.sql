-- Миграция для добавления поддержки карусели фото и комментариев к постам

-- Добавляем поля для карусели в EventProfilePost
ALTER TABLE "EventProfilePost" 
ADD COLUMN IF NOT EXISTS "photoUrls" JSONB,
ADD COLUMN IF NOT EXISTS "captions" JSONB;

-- Создаем таблицу PostComment
CREATE TABLE IF NOT EXISTS "PostComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- Создаем индекс для быстрого поиска комментариев по посту
CREATE INDEX IF NOT EXISTS "PostComment_postId_idx" ON "PostComment"("postId");

-- Добавляем внешние ключи
ALTER TABLE "PostComment" 
ADD CONSTRAINT "PostComment_postId_fkey" 
FOREIGN KEY ("postId") REFERENCES "EventProfilePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostComment" 
ADD CONSTRAINT "PostComment_authorId_fkey" 
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

