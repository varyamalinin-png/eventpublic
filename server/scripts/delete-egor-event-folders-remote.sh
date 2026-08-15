#!/bin/bash
# Скрипт для удаления папок событий пользователя "egor" на продакшн сервере

set -e

echo "🚀 Удаление папок событий пользователя 'egor' на продакшн сервере..."

# Переменные
VM_USER="ubuntu"
VM_HOST="158.160.67.4"
SSH_KEY="$HOME/.ssh/yandex-cloud"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
PROJECT_DIR="/home/ubuntu/event_app_new"

# Проверка SSH ключа
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH ключ не найден: $SSH_KEY"
    echo "Создайте ключ или укажите правильный путь"
    exit 1
fi

echo ""
echo "📡 Подключение к серверу и выполнение скрипта..."

# Выполняем скрипт на сервере
ssh $SSH_OPTS ${VM_USER}@${VM_HOST} << ENDSSH
cd ${PROJECT_DIR}/server
node scripts/delete-egor-event-folders.js
ENDSSH

echo ""
echo "✅ Готово!"
