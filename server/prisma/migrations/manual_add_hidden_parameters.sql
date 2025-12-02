-- Добавляем поле hiddenParameters в таблицу EventProfile
ALTER TABLE "EventProfile" ADD COLUMN IF NOT EXISTS "hiddenParameters" JSONB;

