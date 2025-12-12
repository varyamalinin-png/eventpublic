#!/bin/bash
# Скрипт для установки роли ADMIN пользователю egor на Yandex Cloud VM через SSH

echo "🔧 Установка роли ADMIN для пользователя egor на Yandex Cloud VM..."
echo ""

# Проверяем наличие переменных окружения для SSH
if [ -z "$YANDEX_VM_HOST" ] || [ -z "$YANDEX_VM_USER" ]; then
  # Пробуем использовать стандартные значения
  YANDEX_VM_HOST="${YANDEX_VM_HOST:-89.169.173.152}"
  YANDEX_VM_USER="${YANDEX_VM_USER:-ubuntu}"
  echo "⚠️  Используем значения по умолчанию: $YANDEX_VM_USER@$YANDEX_VM_HOST"
fi

# Определяем путь к SSH ключу
SSH_KEY_OPTION=""
if [ -n "$YANDEX_VM_SSH_KEY" ]; then
  SSH_KEY_OPTION="-i $YANDEX_VM_SSH_KEY"
  echo "🔑 Используем SSH ключ: $YANDEX_VM_SSH_KEY"
fi

# Пробуем разные ключи, если не указан явно
if [ -z "$YANDEX_VM_SSH_KEY" ]; then
  for KEY in ~/.ssh/id_rsa ~/.ssh/id_ed25519 ~/.ssh/yandex_key ~/.ssh/event_app_key ~/.ssh/yandex_cloud_key; do
    if [ -f "$KEY" ]; then
      SSH_KEY_OPTION="-i $KEY"
      echo "🔑 Найден ключ: $KEY"
      break
    fi
  done
fi

# Копируем скрипт на сервер
echo "📤 Копирование скрипта на сервер..."
scp $SSH_KEY_OPTION -o ConnectTimeout=10 -o StrictHostKeyChecking=no server/scripts/set-egor-admin.js $YANDEX_VM_USER@$YANDEX_VM_HOST:/tmp/set-egor-admin.js 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Не удалось скопировать скрипт. Проверьте SSH подключение."
  exit 1
fi

# Выполняем скрипт на сервере
echo "🚀 Выполнение скрипта на сервере..."
ssh $SSH_KEY_OPTION -o ConnectTimeout=10 -o StrictHostKeyChecking=no $YANDEX_VM_USER@$YANDEX_VM_HOST bash << 'ENDSSH'
# Ищем директорию сервера
SERVER_DIR=""
for dir in "/home/ubuntu/event_app_new/server" "/root/server" "/home/ubuntu/server" "/app/server" "/var/www/server" "/opt/server" "~/server" "$HOME/server"; do
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
  echo "✅ DATABASE_URL загружен из .env"
else
  echo "⚠️  .env файл не найден, используем переменную окружения"
fi

# Выполняем скрипт
echo "🔧 Выполняю скрипт установки роли ADMIN..."
node /tmp/set-egor-admin.js

# Удаляем временный файл
rm /tmp/set-egor-admin.js
ENDSSH

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Готово!"
else
  echo ""
  echo "❌ Ошибка при выполнении скрипта на сервере"
  exit 1
fi

