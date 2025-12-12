#!/bin/bash
# Скрипт для перезапуска сервера на Yandex Cloud VM

echo "🔄 Перезапуск сервера на Yandex Cloud VM..."
echo ""

# Переменные по умолчанию
YANDEX_VM_HOST="${YANDEX_VM_HOST:-89.169.173.152}"
YANDEX_VM_USER="${YANDEX_VM_USER:-ubuntu}"

echo "📍 Подключение к: $YANDEX_VM_USER@$YANDEX_VM_HOST"

# Определяем путь к SSH ключу
SSH_KEY_OPTION=""
if [ -n "$YANDEX_VM_SSH_KEY" ]; then
  SSH_KEY_OPTION="-i $YANDEX_VM_SSH_KEY"
  echo "🔑 Используем SSH ключ: $YANDEX_VM_SSH_KEY"
else
  # Пробуем найти ключ автоматически
  for KEY in ~/.ssh/yandex-cloud ~/.ssh/yandex_key ~/.ssh/event_app_key ~/.ssh/yandex_cloud_key ~/.ssh/id_rsa ~/.ssh/id_ed25519; do
    if [ -f "$KEY" ]; then
      SSH_KEY_OPTION="-i $KEY"
      echo "🔑 Найден ключ: $KEY"
      break
    fi
  done
fi

# Выполняем перезапуск на сервере
echo "🚀 Перезапуск сервера..."
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

# Проверяем, используется ли PM2
if command -v pm2 &> /dev/null; then
  echo "📊 Текущий статус PM2:"
  pm2 status
  
  # Ищем процесс сервера
  SERVER_PROCESS=$(pm2 list | grep -E "(server|event-app|backend|nest)" | head -1 | awk '{print $2}')
  
  if [ -n "$SERVER_PROCESS" ]; then
    echo "🔄 Перезапускаем процесс: $SERVER_PROCESS"
    pm2 restart "$SERVER_PROCESS"
    sleep 2
    pm2 status
  else
    echo "⚠️  Процесс сервера не найден в PM2, пробуем запустить..."
    # Пробуем запустить через PM2
    if [ -f "package.json" ]; then
      pm2 start npm --name "event-app-server" -- run start:prod || pm2 start dist/main.js --name "event-app-server"
      pm2 save
      sleep 2
      pm2 status
    fi
  fi
else
  echo "⚠️  PM2 не установлен, пробуем перезапустить через systemd или напрямую..."
  # Пробуем через systemd
  if systemctl is-active --quiet event-app-server || systemctl is-active --quiet nestjs-server; then
    echo "🔄 Перезапускаем через systemd..."
    sudo systemctl restart event-app-server || sudo systemctl restart nestjs-server
    sleep 2
    sudo systemctl status event-app-server || sudo systemctl status nestjs-server
  else
    echo "⚠️  Systemd сервис не найден. Проверьте, как запущен сервер."
  fi
fi

echo ""
echo "✅ Перезапуск выполнен!"
ENDSSH

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Сервер перезапущен успешно!"
else
  echo ""
  echo "❌ Ошибка при перезапуске сервера"
  exit 1
fi

