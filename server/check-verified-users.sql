-- Проверка верифицированных пользователей
-- Показываем всех пользователей с их статусом верификации

SELECT 
    id,
    email,
    username,
    "emailVerified" as verified,
    "createdAt",
    "updatedAt"
FROM "User"
ORDER BY "emailVerified" DESC, "createdAt" DESC;
