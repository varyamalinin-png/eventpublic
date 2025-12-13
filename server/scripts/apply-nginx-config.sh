#!/bin/bash
# Скрипт для применения обновленной конфигурации nginx на сервере

set -e

echo "🔧 Применение обновленной конфигурации nginx..."

# Переменные
VM_USER="ubuntu"
VM_HOST="89.169.173.152"
SSH_KEY="~/.ssh/yandex-cloud"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

# Проверяем наличие SSH ключа
if [ ! -f ~/.ssh/yandex-cloud ]; then
  echo "⚠️  SSH ключ ~/.ssh/yandex-cloud не найден, пробуем другие ключи..."
  for KEY in ~/.ssh/id_rsa ~/.ssh/id_ed25519 ~/.ssh/yandex_key ~/.ssh/event_app_key ~/.ssh/yandex_cloud_key; do
    if [ -f "$KEY" ]; then
      SSH_KEY="$KEY"
      SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
      echo "✅ Найден ключ: $SSH_KEY"
      break
    fi
  done
fi

# Копируем конфигурацию на сервер
echo "📤 Копирование конфигурации nginx на сервер..."
scp $SSH_OPTS server/nginx-iventapp-fix.conf ${VM_USER}@${VM_HOST}:/tmp/nginx-iventapp-fix.conf

if [ $? -ne 0 ]; then
  echo "❌ Не удалось скопировать конфигурацию. Проверьте SSH подключение."
  exit 1
fi

# Применяем конфигурацию на сервере
echo "🚀 Применение конфигурации на сервере..."
ssh $SSH_OPTS ${VM_USER}@${VM_HOST} << 'ENDSSH'
# Создаем резервную копию текущей конфигурации
if [ -f /etc/nginx/sites-available/iventapp.ru ]; then
  sudo cp /etc/nginx/sites-available/iventapp.ru /etc/nginx/sites-available/iventapp.ru.backup.$(date +%Y%m%d_%H%M%S)
  echo "✅ Создана резервная копия конфигурации"
fi

# Копируем новую конфигурацию
sudo cp /tmp/nginx-iventapp-fix.conf /etc/nginx/sites-available/iventapp.ru
echo "✅ Конфигурация скопирована"

# Проверяем конфигурацию
echo "🔍 Проверка конфигурации nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
  echo "✅ Конфигурация валидна"
  
  # Перезагружаем nginx
  echo "🔄 Перезагрузка nginx..."
  sudo systemctl reload nginx
  
  if [ $? -eq 0 ]; then
    echo "✅ Nginx успешно перезагружен"
  else
    echo "❌ Ошибка при перезагрузке nginx"
    exit 1
  fi
else
  echo "❌ Ошибка в конфигурации nginx!"
  echo "Откатываем изменения..."
  if [ -f /etc/nginx/sites-available/iventapp.ru.backup.* ]; then
    sudo cp /etc/nginx/sites-available/iventapp.ru.backup.* /etc/nginx/sites-available/iventapp.ru
    sudo nginx -t && sudo systemctl reload nginx
  fi
  exit 1
fi

# Удаляем временный файл
rm /tmp/nginx-iventapp-fix.conf
echo "✅ Временный файл удален"
ENDSSH

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Конфигурация nginx успешно применена!"
  echo "🌐 Проверьте работу API: https://iventapp.ru/event-folders"
else
  echo ""
  echo "❌ Ошибка при применении конфигурации"
  exit 1
fi
