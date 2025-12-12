#!/bin/bash
# Прямое выполнение SQL запроса для установки роли ADMIN
# Используйте этот скрипт, если есть прямой доступ к базе данных

echo "🔧 Установка роли ADMIN для пользователя egor..."
echo ""

# Пробуем подключиться к базе данных через разные методы
# Метод 1: Через переменную окружения DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
  echo "📊 Используем DATABASE_URL из окружения"
  psql "$DATABASE_URL" -c "UPDATE \"User\" SET role = 'ADMIN' WHERE username = 'egor';"
  psql "$DATABASE_URL" -c "SELECT id, username, email, name, role FROM \"User\" WHERE username = 'egor';"
  exit 0
fi

# Метод 2: Через .env файл в текущей директории
if [ -f .env ]; then
  echo "📊 Загружаем DATABASE_URL из .env"
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "UPDATE \"User\" SET role = 'ADMIN' WHERE username = 'egor';"
    psql "$DATABASE_URL" -c "SELECT id, username, email, name, role FROM \"User\" WHERE username = 'egor';"
    exit 0
  fi
fi

# Метод 3: Через Node.js скрипт (если Prisma доступен)
echo "📊 Используем Node.js скрипт через Prisma"
node server/scripts/set-egor-admin.js

