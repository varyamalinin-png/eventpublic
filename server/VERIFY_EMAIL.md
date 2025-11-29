# Верификация Email через Railway

## Вариант 1: Через Railway CLI (быстро)

```bash
# 1. Подключитесь к базе данных Railway
npx -y @railway/cli connect postgres

# 2. Выполните SQL:
UPDATE "User" SET "emailVerified" = true WHERE email = 'varya.malinina.2003@mail.ru';
```

## Вариант 2: Через скрипт (если есть локальный доступ)

```bash
cd server
node scripts/verify-email.js varya.malinina.2003@mail.ru
```

## Вариант 3: Верифицировать все email

```bash
cd server
node scripts/verify-all-emails.js
```

## После верификации:

1. Вход будет работать без проблем
2. Домен не нужен
3. Можно продолжать разработку

