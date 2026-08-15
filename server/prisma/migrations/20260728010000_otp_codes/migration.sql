-- Переход с длинного hex-токена на шестизначный код.
-- Глобальная уникальность больше не годится: у кода миллион вариантов, коллизии
-- при вставке неизбежны, а главное — код, уникальный на всю таблицу, подтверждал
-- бы любой аккаунт. Код теперь действителен только в паре со своим пользователем.
DROP INDEX IF EXISTS "EmailVerificationToken_token_key";

-- Счётчик попыток: шесть цифр без ограничения перебираются за минуты.
ALTER TABLE "EmailVerificationToken" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

-- Старые длинные токены больше не проверить новым кодом — удаляем,
-- пользователи запросят код заново.
DELETE FROM "EmailVerificationToken";

CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_token_idx"
  ON "EmailVerificationToken"("userId", "token");
