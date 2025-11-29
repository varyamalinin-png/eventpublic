-- SQL для удаления всех пользователей в Railway
-- Выполните в Railway PostgreSQL Dashboard

-- Удаляем всех пользователей
DELETE FROM "User";

-- Проверка
SELECT COUNT(*) as remaining_users FROM "User";
