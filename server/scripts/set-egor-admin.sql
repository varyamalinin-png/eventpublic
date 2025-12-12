-- SQL скрипт для установки роли ADMIN пользователю egor
-- Выполните на VM: psql $DATABASE_URL -f set-egor-admin.sql

UPDATE "User" 
SET role = 'ADMIN' 
WHERE username = 'egor';

-- Проверяем результат
SELECT id, username, email, name, role 
FROM "User" 
WHERE username = 'egor';

