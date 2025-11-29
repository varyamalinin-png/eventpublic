-- Простой SQL запрос для верификации email
-- Выполните этот запрос в Railway PostgreSQL Dashboard

UPDATE "User" 
SET "emailVerified" = true 
WHERE email = 'varya.malinina.2003@mail.ru';

-- Или верифицировать все email сразу:
-- UPDATE "User" SET "emailVerified" = true;
