-- Список только верифицированных пользователей
SELECT 
    email as login,
    username,
    email,
    id,
    "createdAt"
FROM "User"
WHERE "emailVerified" = true
ORDER BY "createdAt" DESC;
