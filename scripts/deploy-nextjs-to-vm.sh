#!/bin/bash
# Скрипт для деплоя Next.js приложения на VM

set -e

echo "🚀 Деплой Next.js приложения на VM..."

# Переменные
VM_USER="ubuntu"
VM_HOST="158.160.67.4"
VM_PATH="/home/ubuntu/iventapp-nextjs"
SSH_KEY="$HOME/.ssh/yandex-cloud"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

cd client/web

# Собираем приложение
echo "📦 Собираем Next.js приложение..."
npm run build

# Создаем директорию на сервере
echo "📁 Создаем директорию на сервере..."
ssh $SSH_OPTS ${VM_USER}@${VM_HOST} "mkdir -p ${VM_PATH}"

# Копируем необходимые файлы на сервер
echo "📤 Копируем файлы на сервер..."
rsync -avz --delete -e "ssh $SSH_OPTS" \
  --exclude 'node_modules' \
  --exclude '.next/cache' \
  --exclude '.git' \
  . ${VM_USER}@${VM_HOST}:${VM_PATH}/

# Копируем статические файлы в standalone директорию ДО установки зависимостей
echo "📁 Копируем статические файлы..."
rsync -avz --delete -e "ssh $SSH_OPTS" \
  .next/static ${VM_USER}@${VM_HOST}:${VM_PATH}/.next/standalone/web/.next/ 2>/dev/null || true

rsync -avz --delete -e "ssh $SSH_OPTS" \
  public ${VM_USER}@${VM_HOST}:${VM_PATH}/.next/standalone/web/ 2>/dev/null || true

# Устанавливаем зависимости и запускаем на сервере
echo "🔧 Устанавливаем зависимости и запускаем приложение..."
ssh $SSH_OPTS ${VM_USER}@${VM_HOST} << 'ENDSSH'
cd /home/ubuntu/iventapp-nextjs
npm install --production
# Убеждаемся, что статические файлы скопированы
cp -r .next/static .next/standalone/web/.next/ 2>/dev/null || true
cp -r public .next/standalone/web/ 2>/dev/null || true
# Проверяем наличие favicon
ls -la .next/standalone/web/public/favicon.svg || echo "WARNING: favicon.svg not found"
pm2 stop event-app-web || true
pm2 delete event-app-web || true
PORT=3000 pm2 start node --name "event-app-web" -- .next/standalone/web/server.js
pm2 save
ENDSSH

echo "✅ Деплой завершен!"
echo "🌐 Приложение должно быть доступно на http://${VM_HOST}:3000"
echo "📊 Проверьте статус: ssh ${VM_USER}@${VM_HOST} 'pm2 status'"
