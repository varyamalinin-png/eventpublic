#!/bin/bash
# Настроить отправку писем через Postbox (статический ключ) на VM и перезапустить backend.
# Использование:
#   YANDEX_CLOUD_ACCESS_KEY_ID=xxx YANDEX_CLOUD_SECRET_ACCESS_KEY=yyy ./server/scripts/set-postbox-on-vm.sh
#   или: ./server/scripts/set-postbox-on-vm.sh YCAJ... YCPu0...
set -e
VM_USER="${VM_USER:-ubuntu}"
VM_HOST="${VM_HOST:-158.160.67.4}"
PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/event_app_new}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/yandex-cloud}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
FROM_EMAIL="${YANDEX_CLOUD_FROM_EMAIL:-noreply@iventapp.ru}"

ACCESS_KEY_ID="${YANDEX_CLOUD_ACCESS_KEY_ID:-$1}"
SECRET_ACCESS_KEY="${YANDEX_CLOUD_SECRET_ACCESS_KEY:-$2}"

if [ -z "$ACCESS_KEY_ID" ] || [ -z "$SECRET_ACCESS_KEY" ]; then
  echo "Использование: YANDEX_CLOUD_ACCESS_KEY_ID=... YANDEX_CLOUD_SECRET_ACCESS_KEY=... $0"
  echo "  или: $0 <AccessKeyId> <Secret>"
  exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
  echo "❌ SSH ключ не найден: $SSH_KEY"
  exit 1
fi

echo "📍 Подключение к ${VM_USER}@${VM_HOST}, настройка Postbox в .env..."
ssh $SSH_OPTS ${VM_USER}@${VM_HOST} bash -s -- "$ACCESS_KEY_ID" "$SECRET_ACCESS_KEY" "$FROM_EMAIL" "$PROJECT_DIR" << 'REMOTE'
  set -e
  ACCESS_KEY_ID="$1"
  SECRET_ACCESS_KEY="$2"
  FROM_EMAIL="$3"
  PROJECT_DIR="$4"
  SERVER_DIR="${PROJECT_DIR}/server"

  [ -d "$SERVER_DIR" ] || SERVER_DIR="/home/ubuntu/event_app_new/server"
  if [ ! -f "$SERVER_DIR/.env" ]; then
    echo "❌ .env не найден: $SERVER_DIR/.env"
    exit 1
  fi

  cd "$SERVER_DIR"
  grep -v -e '^YANDEX_IAM_TOKEN=' -e '^YANDEX_CLOUD_ACCESS_KEY_ID=' -e '^YANDEX_CLOUD_SECRET_ACCESS_KEY=' -e '^YANDEX_CLOUD_FROM_EMAIL=' .env > .env.new || true
  echo "YANDEX_CLOUD_ACCESS_KEY_ID=$ACCESS_KEY_ID" >> .env.new
  echo "YANDEX_CLOUD_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY" >> .env.new
  echo "YANDEX_CLOUD_FROM_EMAIL=$FROM_EMAIL" >> .env.new
  mv .env.new .env
  echo "✅ В .env заданы Postbox ключи, IAM токен убран"

  if command -v pm2 &>/dev/null; then
    PROC=$(pm2 list 2>/dev/null | grep -E "(server|event-app|backend|nest)" | head -1 | awk '{print $2}')
    if [ -n "$PROC" ]; then
      pm2 restart "$PROC"
      pm2 save
      echo "✅ Backend перезапущен: $PROC"
    fi
  fi
REMOTE

echo ""
echo "✅ Готово. Проверка: curl -s https://iventapp.ru/auth/email-status"
curl -s "https://iventapp.ru/auth/email-status"
echo ""
