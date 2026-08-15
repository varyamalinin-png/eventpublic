#!/bin/bash
# Задать на VM переменные Yandex Cloud для отправки писем и перезапустить backend.
# Использование: ./server/scripts/set-yandex-email-on-vm.sh
# Переопределение хоста: VM_HOST=158.160.67.4 ./server/scripts/set-yandex-email-on-vm.sh

set -e
VM_USER="${VM_USER:-ubuntu}"
VM_HOST="${VM_HOST:-158.160.67.4}"
PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/event_app_new}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/yandex-cloud}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
FROM_EMAIL="${YANDEX_CLOUD_FROM_EMAIL:-noreply@iventapp.ru}"

if [ ! -f "$SSH_KEY" ]; then
  echo "❌ SSH ключ не найден: $SSH_KEY"
  exit 1
fi

echo "📧 Получение IAM-токена..."
IAM_TOKEN=$(cd "$(dirname "$0")/../.." && node server/scripts/get-yandex-iam-token.js 2>/dev/null | sed -n 's/^YANDEX_IAM_TOKEN=//p' | tr -d '\r')
if [ -z "$IAM_TOKEN" ]; then
  echo "❌ Не удалось получить IAM-токен (node server/scripts/get-yandex-iam-token.js)"
  exit 1
fi
echo "   ✅ Токен получен"

echo ""
echo "📍 Подключение к ${VM_USER}@${VM_HOST}, директория ${PROJECT_DIR}/server"
echo "   Добавление YANDEX_IAM_TOKEN и YANDEX_CLOUD_FROM_EMAIL в .env и перезапуск backend..."
echo ""

ssh $SSH_OPTS ${VM_USER}@${VM_HOST} bash -s -- "$IAM_TOKEN" "$FROM_EMAIL" "$PROJECT_DIR" << 'REMOTE'
  set -e
  TOKEN="$1"
  FROM_EMAIL="$2"
  PROJECT_DIR="$3"
  SERVER_DIR="${PROJECT_DIR}/server"

  if [ ! -d "$SERVER_DIR" ]; then
    for d in /home/ubuntu/event_app_new/server /home/ubuntu/server /root/server; do
      if [ -d "$d" ] && [ -f "$d/package.json" ]; then SERVER_DIR="$d"; break; fi
    done
  fi
  if [ ! -d "$SERVER_DIR" ] || [ ! -f "$SERVER_DIR/package.json" ]; then
    echo "❌ Директория сервера не найдена: $SERVER_DIR"
    exit 1
  fi

  cd "$SERVER_DIR"
  if [ ! -f .env ]; then
    echo "❌ Файл .env не найден в $SERVER_DIR"
    exit 1
  fi

  grep -v '^YANDEX_IAM_TOKEN=' .env | grep -v '^YANDEX_CLOUD_FROM_EMAIL=' > .env.new || true
  echo "YANDEX_IAM_TOKEN=$TOKEN" >> .env.new
  echo "YANDEX_CLOUD_FROM_EMAIL=$FROM_EMAIL" >> .env.new
  mv .env.new .env
  echo "✅ В .env добавлены YANDEX_IAM_TOKEN и YANDEX_CLOUD_FROM_EMAIL"

  if command -v pm2 &>/dev/null; then
    PROC=$(pm2 list 2>/dev/null | grep -E "(server|event-app|backend|nest)" | head -1 | awk '{print $2}')
    if [ -n "$PROC" ]; then
      export YANDEX_IAM_TOKEN="$TOKEN"
      export YANDEX_CLOUD_FROM_EMAIL="$FROM_EMAIL"
      pm2 restart "$PROC" --update-env
      pm2 save
      echo "✅ Backend перезапущен с новыми переменными (pm2 restart $PROC --update-env)"
    else
      echo "⚠️  Процесс backend не найден в pm2 list. Выполните вручную: pm2 restart <name> --update-env"
    fi
  else
    echo "⚠️  PM2 не найден. Перезапустите backend вручную."
  fi
REMOTE

echo ""
echo "✅ Готово. Проверка: curl -s https://iventapp.ru/auth/email-status"
curl -s "https://iventapp.ru/auth/email-status" | head -1
echo ""
