#!/bin/bash
# Скрипт для исправления события "ramen" на Yandex Cloud VM через SSH

echo "🔧 Исправление события 'ramen' на Yandex Cloud VM..."
echo ""

# Проверяем наличие переменных окружения для SSH
if [ -z "$YANDEX_VM_HOST" ] || [ -z "$YANDEX_VM_USER" ]; then
  echo "❌ Не установлены переменные окружения для SSH подключения!"
  echo "Установите:"
  echo "  export YANDEX_VM_HOST=your-vm-ip-or-hostname"
  echo "  export YANDEX_VM_USER=your-username"
  echo "  export YANDEX_VM_SSH_KEY=path-to-ssh-key (опционально)"
  exit 1
fi

# Определяем путь к SSH ключу
SSH_KEY_OPTION=""
if [ -n "$YANDEX_VM_SSH_KEY" ]; then
  SSH_KEY_OPTION="-i $YANDEX_VM_SSH_KEY"
fi

# Копируем скрипт на сервер
echo "📤 Копирование скрипта на сервер..."
scp $SSH_KEY_OPTION server/scripts/fix-ramen-event-profile.js $YANDEX_VM_USER@$YANDEX_VM_HOST:/tmp/fix-ramen-event-profile.js

# Выполняем скрипт на сервере
echo "🚀 Выполнение скрипта на сервере..."
ssh $SSH_KEY_OPTION $YANDEX_VM_USER@$YANDEX_VM_HOST bash << 'ENDSSH'
# Ищем директорию сервера
SERVER_DIR=""
for dir in "/root/server" "/home/ubuntu/server" "/app/server" "/var/www/server" "/opt/server" "~/server" "$HOME/server"; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    SERVER_DIR="$dir"
    break
  fi
done

if [ -z "$SERVER_DIR" ]; then
  echo "❌ Не найдена директория сервера!"
  exit 1
fi

echo "📁 Директория сервера: $SERVER_DIR"
cd "$SERVER_DIR"

# Загружаем DATABASE_URL из .env если он там есть
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

# Выполняем скрипт
echo "🔧 Выполняю скрипт исправления..."
node /tmp/fix-ramen-event-profile.js

# Удаляем временный файл
rm /tmp/fix-ramen-event-profile.js
ENDSSH

echo ""
echo "✅ Готово!"
