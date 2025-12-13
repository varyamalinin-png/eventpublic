#!/bin/bash

# Скрипт для развертывания исправления добавления событий в папки

SERVER="ubuntu@158.160.52.216"
SERVER_PATH="/home/ubuntu/event_app_new/server"
LOCAL_FILE="server/src/events/event-folders.service.ts"
REMOTE_FILE="/tmp/event-folders.service.ts"
FINAL_PATH="$SERVER_PATH/src/events/event-folders.service.ts"

echo "📦 Копирую файл на сервер..."
scp "$LOCAL_FILE" "$SERVER:$REMOTE_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при копировании файла"
    exit 1
fi

echo "📁 Перемещаю файл в правильное место..."
ssh "$SERVER" "sudo mv $REMOTE_FILE $FINAL_PATH && sudo chown ubuntu:ubuntu $FINAL_PATH"

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при перемещении файла"
    exit 1
fi

echo "🔄 Перезапускаю сервер..."
ssh "$SERVER" "cd $SERVER_PATH && pm2 restart all"

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при перезапуске сервера"
    exit 1
fi

echo "✅ Развертывание завершено!"
echo "📋 Проверяю логи..."
ssh "$SERVER" "cd $SERVER_PATH && pm2 logs --lines 20 --nostream"
