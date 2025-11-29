-- SQL скрипт для верификации пользователя в Railway
-- Выполните этот SQL в Railway PostgreSQL Dashboard

-- Вариант 1: Верифицировать пользователя по email
UPDATE "User" 
SET "emailVerified" = true 
WHERE email = 'varya.malinina.2003@mail.ru';

-- Вариант 2: Верифицировать пользователя по ID из логов Railway
UPDATE "User" 
SET "emailVerified" = true 
WHERE id = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';

-- Вариант 3: Верифицировать ВСЕХ пользователей (на всякий случай)
-- UPDATE "User" SET "emailVerified" = true;

-- Проверка результата
SELECT id, email, username, "emailVerified" 
FROM "User" 
WHERE email = 'varya.malinina.2003@mail.ru' 
   OR id = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';
