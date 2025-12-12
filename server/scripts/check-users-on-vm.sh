#!/bin/bash
# Скрипт для проверки пользователей на VM
# Выполните на VM: bash check-users-on-vm.sh

echo "🔍 Проверка пользователей nastya, varya и egor в базе данных"
echo ""

cd /home/ubuntu/event_app_new/server || cd ~/event_app_new/server || cd /app/server || exit 1

# Загружаем DATABASE_URL из .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

# Выполняем скрипт проверки
node scripts/check-users-usernames.js

