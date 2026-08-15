#!/usr/bin/env bash
# Деплой статики VK Mini App на прод-VM: https://iventapp.ru/vk-app/
#
# На сервере должны существовать каталоги и права (один раз):
#   sudo mkdir -p /var/www/vk-app && sudo chown -R ubuntu:ubuntu /var/www/vk-app
#
# После первого деплоя обновите nginx (server/nginx-iventapp-fix.conf) и:
#   sudo nginx -t && sudo systemctl reload nginx
#
# Переопределение хоста: VM_HOST=1.2.3.4 ./scripts/deploy-vk-mini-app-to-vm.sh

set -euo pipefail

VM_USER="${VM_USER:-ubuntu}"
VM_HOST="${VM_HOST:-213.165.213.224}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/yandex-cloud}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/vk-app}"
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VK_DIR="$ROOT/vk-mini-app"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "❌ SSH ключ не найден: $SSH_KEY"
  exit 1
fi

if [[ ! -d "$VK_DIR" ]]; then
  echo "❌ Нет каталога vk-mini-app"
  exit 1
fi

echo "📦 Сборка vk-mini-app..."
cd "$VK_DIR"
# Подхватываем vk-mini-app/.env (VITE_VK_GROUP_ID, VITE_BRAND_HERO_URL и т.д.), если файл есть
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "   (загружен vk-mini-app/.env)"
fi
# Значения по умолчанию; переменные из текущей оболочки имеют приоритет над .env выше — задайте export при необходимости
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://iwent.ru}"
export VITE_MAIN_WEB_URL="${VITE_MAIN_WEB_URL:-https://iwent.ru}"
export VITE_VK_GROUP_ID="${VITE_VK_GROUP_ID:-0}"
export VITE_BRAND_HERO_URL="${VITE_BRAND_HERO_URL:-}"
npm ci
npm run build

echo "📤 rsync → ${VM_USER}@${VM_HOST}:${REMOTE_DIR}/"
ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" "mkdir -p '${REMOTE_DIR}'"
rsync -avz --delete -e "ssh ${SSH_OPTS[*]}" \
  "${VK_DIR}/build/" \
  "${VM_USER}@${VM_HOST}:${REMOTE_DIR}/"

echo ""
echo "✅ Готово. Проверка: https://iwent.ru/vk-app/"
echo "   В кабинете ВК укажите этот URL в «Размещение» (веб / mvk / приложение)."
