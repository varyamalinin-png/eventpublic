#!/bin/bash
# Синхронизация участников EventProfile на продакшн VM (база на VM или DATABASE_URL в .env)

set -e

VM_USER="ubuntu"
VM_HOST="158.160.67.4"
SSH_KEY="$HOME/.ssh/yandex-cloud"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
PROJECT_DIR="/home/ubuntu/event_app_new"

if [ ! -f "$SSH_KEY" ]; then
  echo "❌ SSH ключ не найден: $SSH_KEY"
  exit 1
fi

echo "🔍 Копирую скрипт на VM (в директорию server)..."
scp $SSH_OPTS server/scripts/sync-event-profile-participants.js ${VM_USER}@${VM_HOST}:${PROJECT_DIR}/server/scripts/

echo "🚀 Запуск синхронизации на сервере..."
ssh $SSH_OPTS ${VM_USER}@${VM_HOST} << ENDSSH
cd ${PROJECT_DIR}/server 2>/dev/null || cd /home/ubuntu/server 2>/dev/null || cd /root/server 2>/dev/null || { echo "❌ Директория server не найдена"; exit 1; }
if [ -f .env ]; then
  export \$(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi
if [ -z "\$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL не найден в .env"
  exit 1
fi
node scripts/sync-event-profile-participants.js
ENDSSH

echo ""
echo "✅ Готово!"
