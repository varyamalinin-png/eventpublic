# Добавление поля accountType в базу данных

Поле `accountType` уже добавлено в Prisma схему и Prisma клиент сгенерирован.

Теперь нужно добавить поле в базу данных одним из способов:

## Способ 1: Через Prisma Studio или любую SQL консоль

Выполните SQL команду:
```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountType" TEXT DEFAULT 'personal';
```

## Способ 2: Через миграцию Prisma

Если у вас есть доступ к базе данных через psql или другой SQL клиент, создайте миграцию вручную:

1. Создайте файл миграции: `prisma/migrations/YYYYMMDDHHMMSS_add_account_type_to_user/migration.sql`
2. Добавьте SQL:
   ```sql
   -- AlterTable
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountType" TEXT DEFAULT 'personal';
   ```
3. Примените миграцию: `npx prisma migrate deploy`

## Способ 3: Через Prisma DB Push (если проблема с индексами решена)

```bash
npx prisma db push --accept-data-loss
```

После добавления поля в базу данных, перезапустите сервер и регистрация должна работать.
