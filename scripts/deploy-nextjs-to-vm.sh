#!/bin/bash
# Скрипт для деплоя Next.js приложения на прод-VM
#
# Прод (iwent.ru): VM на reg.ru — 91.197.99.213, веб лежит в /opt/iwent/web.
# До 8 октября 2026 это была VM Яндекса 213.165.213.224; её дата-центр сгорел.
#   Нужен SSH-доступ: добавьте ваш публичный ключ на сервер:
#   ssh-copy-id -i ~/.ssh/yandex-cloud.pub root@91.197.99.213
#   Или вручную: скопировать содержимое ~/.ssh/yandex-cloud.pub в ~/.ssh/authorized_keys на VM.
#   Затем: ./scripts/deploy-nextjs-to-vm.sh
#
# Режимы сборки:
#   по умолчанию — СБОРКА НА VM в стейджинге /opt/iwent/build с атомарной
#     подменой .next в живом каталоге (сайт не падает во время сборки).
#     Для этого на VM заливаются исходники и web/, и client/ — веб-бандл
#     алиасит @/client -> ../client, без client/ сборка невозможна.
#   LOCAL_BUILD=1 — старый режим: сборка локально на Mac, заливка готового
#     .next. Нужен, если на VM мало ресурсов или сломан toolchain.
#
# Другой хост: VM_HOST=1.2.3.4 ./scripts/deploy-nextjs-to-vm.sh

set -e

echo "🚀 Деплой Next.js приложения на VM..."

# Переменные: по умолчанию прод-VM iwent.ru (Next + nginx на одной машине)
VM_USER="${VM_USER:-root}"
VM_HOST="${VM_HOST:-91.197.99.213}"
VM_PATH="${VM_PATH:-/opt/iwent/web}"
BUILD_PATH="${BUILD_PATH:-/opt/iwent/build}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/yandex-cloud}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

echo "📍 Цель: ${VM_USER}@${VM_HOST}:${VM_PATH} (ключ: $SSH_KEY)"

cd "$(dirname "$0")/.."
ROOT_DIR="$(pwd)"

if [ "${LOCAL_BUILD:-0}" = "1" ]; then
  # ─── Старый режим: сборка локально, заливка готового результата ───
  echo "🏠 LOCAL_BUILD=1 — собираем локально..."
  cd "$ROOT_DIR/web"
  rm -rf .next
  npm run build
  ssh $SSH_OPTS ${VM_USER}@${VM_HOST} "mkdir -p ${VM_PATH}"
  echo "📤 Копируем файлы на сервер..."
  rsync -avz --delete -e "ssh $SSH_OPTS" \
    --exclude 'node_modules' \
    --exclude '.next/cache' \
    --exclude '.git' \
    . ${VM_USER}@${VM_HOST}:${VM_PATH}/
  ssh $SSH_OPTS ${VM_USER}@${VM_HOST} "VM_PATH='${VM_PATH}' bash -s" << 'ENDSSH'
cd "$VM_PATH"
npm install --production
rm -rf .next/cache
pm2 stop event-app-web || true
pm2 delete event-app-web || true
PORT=3000 pm2 start npm --name "event-app-web" -- start
pm2 save
ENDSSH
else
  # ─── Основной режим: сборка на VM в стейджинге ───
  echo "☁️  Сборка будет выполнена на VM (${BUILD_PATH}), живой сайт не трогаем до готовности."

  ssh $SSH_OPTS ${VM_USER}@${VM_HOST} "mkdir -p ${BUILD_PATH}/web ${BUILD_PATH}/client"

  echo "📤 Синхронизируем web/ -> ${BUILD_PATH}/web ..."
  rsync -avz --delete -e "ssh $SSH_OPTS" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    "$ROOT_DIR/web/" ${VM_USER}@${VM_HOST}:${BUILD_PATH}/web/

  echo "📤 Синхронизируем client/ -> ${BUILD_PATH}/client ..."
  rsync -avz --delete -e "ssh $SSH_OPTS" \
    --exclude 'node_modules' \
    --exclude 'ios' \
    --exclude 'android' \
    --exclude '.expo' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'web-build' \
    --exclude 'dump.rdb' \
    "$ROOT_DIR/client/" ${VM_USER}@${VM_HOST}:${BUILD_PATH}/client/

  echo "🔧 Собираем на VM и атомарно подменяем .next ..."
  ssh $SSH_OPTS ${VM_USER}@${VM_HOST} "BUILD_PATH='${BUILD_PATH}' VM_PATH='${VM_PATH}' bash -s" << 'ENDSSH'
set -e
cd "$BUILD_PATH/web"
# Полный install: для `next build` нужны devDependencies. node_modules
# живёт в стейджинге между деплоями, поэтому повторно быстро.
npm install
# На VM 4 ГБ RAM — ограничиваем кучу, чтобы сборка не ушла в своп.
NODE_OPTIONS=--max-old-space-size=2816 npm run build

# Атомарная подмена: сначала новый .next рядом, потом быстрый rsync в живой
# каталог и сразу restart — даунтайм секунды, а не вся сборка.
mkdir -p "$VM_PATH"
rsync -a --delete "$BUILD_PATH/web/.next/" "$VM_PATH/.next/"
# Файлы, от которых зависит `next start`, тоже держим синхронными.
rsync -a "$BUILD_PATH/web/package.json" "$BUILD_PATH/web/package-lock.json" "$VM_PATH/" 2>/dev/null || true
rsync -a --delete "$BUILD_PATH/web/public/" "$VM_PATH/public/"
rsync -a "$BUILD_PATH/web/next.config.js" "$VM_PATH/next.config.js"
cd "$VM_PATH"
npm install --production
pm2 restart event-app-web --update-env || PORT=3000 pm2 start npm --name "event-app-web" -- start
pm2 save
ENDSSH
fi

echo "✅ Деплой завершен!"
echo "🌐 Приложение должно быть доступно на https://iwent.ru (и http://${VM_HOST}:3000)"
echo "📊 Проверьте статус: ssh ${VM_USER}@${VM_HOST} 'pm2 status'"
