#!/bin/bash
# Скрипт для выполнения исправления события "ramen" на Yandex Cloud VM
# Использует YC CLI для получения информации и SSH для подключения

VM_NAME="event-app-backend-v2"
VM_IP=$(yc compute instance get --name $VM_NAME --format json 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin)['networkInterfaces'][0]['primaryV4Address']['oneToOneNat']['address'])" 2>/dev/null)

if [ -z "$VM_IP" ]; then
  echo "❌ Не удалось получить IP адрес VM"
  exit 1
fi

echo "🔍 VM IP: $VM_IP"
echo "📤 Копирую скрипт на VM..."

# Пробуем разные пользователи и ключи
for USER in root ubuntu; do
  for KEY in ~/.ssh/id_rsa ~/.ssh/id_ed25519 ~/.ssh/yandex_key ~/.ssh/event_app_key; do
    if [ -f "$KEY" ]; then
      echo "Пробую подключиться как $USER с ключом $KEY..."
      scp -i "$KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no server/scripts/fix-ramen-event-profile.js $USER@$VM_IP:/tmp/ 2>/dev/null && {
        echo "✅ Скрипт скопирован!"
        ssh -i "$KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no $USER@$VM_IP << 'ENDSSH'
cd /root/server 2>/dev/null || cd /home/ubuntu/server 2>/dev/null || cd /app/server 2>/dev/null || cd /var/www/server 2>/dev/null
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  cd /tmp
  node fix-ramen-event-profile.js
  rm fix-ramen-event-profile.js
else
  echo "❌ .env файл не найден"
fi
ENDSSH
        exit 0
      }
    fi
  done
done

echo "❌ Не удалось подключиться к VM. Проверьте SSH ключи."

