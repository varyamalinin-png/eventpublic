#!/bin/bash
# Скрипт для деплоя Next.js приложения на прод-VM
#
# Прод (iwent.ru): та же VM, что и vk-app — 213.165.213.224
#   Нужен SSH-доступ: добавьте ваш публичный ключ на сервер:
#   ssh-copy-id -i ~/.ssh/yandex-cloud.pub ubuntu@213.165.213.224
#   Или вручную: скопировать содержимое ~/.ssh/yandex-cloud.pub в ~/.ssh/authorized_keys на VM.
#   Затем: ./scripts/deploy-nextjs-to-vm.sh
#
# Другой хост: VM_HOST=1.2.3.4 ./scripts/deploy-nextjs-to-vm.sh

set -e

echo "🚀 Деплой Next.js приложения на VM..."

# Переменные: по умолчанию прод-VM iventapp.ru (Next + nginx рядом с /var/www/vk-app)
VM_USER="${VM_USER:-ubuntu}"
VM_HOST="${VM_HOST:-213.165.213.224}"
VM_PATH="/home/ubuntu/iventapp-nextjs"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/yandex-cloud}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

echo "📍 Цель: ${VM_USER}@${VM_HOST} (ключ: $SSH_KEY)"

cd "$(dirname "$0")/.."
WEB_DIR="$(pwd)/web"
cd "$WEB_DIR"

# Чистая сборка (без старого кэша), чтобы подтянуть изменения из client/ (карта, календарь и т.д.)
echo "🧹 Очищаем кэш сборки..."
rm -rf .next

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

# Устанавливаем зависимости и запускаем на сервере
echo "🔧 Устанавливаем зависимости и запускаем приложение..."
ssh $SSH_OPTS ${VM_USER}@${VM_HOST} << 'ENDSSH'
cd /home/ubuntu/iventapp-nextjs
npm install --production
# Очищаем кэш Next.js (Full Route Cache), иначе отдаётся старый пререндер
rm -rf .next/cache
pm2 stop event-app-web || true
pm2 delete event-app-web || true
PORT=3000 pm2 start npm --name "event-app-web" -- start
pm2 save
ENDSSH

echo "✅ Деплой завершен!"
echo "🌐 Приложение должно быть доступно на https://iwent.ru (и http://${VM_HOST}:3000)"
echo "📊 Проверьте статус: ssh ${VM_USER}@${VM_HOST} 'pm2 status'"
