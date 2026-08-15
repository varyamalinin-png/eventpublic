#!/usr/bin/env bash
# Деплой статики Telegram Mini App на прод-VM: https://iventapp.ru/tg-app/
#
# На сервере (один раз): sudo mkdir -p /var/www/tg-app && sudo chown -R ubuntu:ubuntu /var/www/tg-app
# Nginx: см. server/nginx-iventapp-fix.conf — location ^~ /tg-app/

set -euo pipefail

VM_USER="${VM_USER:-ubuntu}"
VM_HOST="${VM_HOST:-213.165.213.224}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/yandex-cloud}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/tg-app}"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TG_DIR="$ROOT/tg-mini-app"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "❌ SSH ключ не найден: $SSH_KEY"
  exit 1
fi

if [[ ! -d "$TG_DIR" ]]; then
  echo "❌ Нет каталога tg-mini-app"
  exit 1
fi

echo "📦 Сборка tg-mini-app..."
cd "$TG_DIR"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "   (загружен tg-mini-app/.env)"
fi
export VITE_MAIN_WEB_URL="${VITE_MAIN_WEB_URL:-https://iwent.ru}"
export VITE_TELEGRAM_URL="${VITE_TELEGRAM_URL:-https://t.me/iwentapp}"
export VITE_VK_COMMUNITY_URL="${VITE_VK_COMMUNITY_URL:-https://vk.ru/club237398722}"
export VITE_TELEGRAM_BOT_USERNAME="${VITE_TELEGRAM_BOT_USERNAME:-iwenttobot}"
npm ci
npm run build

echo "📤 rsync → ${VM_USER}@${VM_HOST}:${REMOTE_DIR}/"
ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" \
  "sudo mkdir -p '${REMOTE_DIR}' && sudo chown -R '${VM_USER}:${VM_USER}' '${REMOTE_DIR}'"
rsync -avz --delete -e "ssh ${SSH_OPTS[*]}" \
  "${TG_DIR}/build/" \
  "${VM_USER}@${VM_HOST}:${REMOTE_DIR}/"

echo ""
echo "✅ Готово. URL Mini App: https://iwent.ru/tg-app/"
echo "   В @BotFather: Bot Settings → Configure Mini App → укажите этот URL."
