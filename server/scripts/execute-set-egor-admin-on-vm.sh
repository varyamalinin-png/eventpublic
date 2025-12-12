#!/bin/bash
# Скрипт для установки роли ADMIN пользователю egor на Yandex Cloud VM

VM_NAME="event-app-backend-v2"
VM_IP=$(yc compute instance list --format json 2>/dev/null | python3 -c "import sys, json; instances = json.load(sys.stdin); vm = next((i for i in instances if i['name'] == 'event-app-backend-v2'), None); print(vm['network_interfaces'][0]['primary_v4_address']['one_to_one_nat']['address'] if vm and vm.get('network_interfaces') else '')" 2>/dev/null)

if [ -z "$VM_IP" ]; then
  # Используем IP из вывода yc compute instance list
  VM_IP="89.169.173.152"
  echo "⚠️  Используем IP из списка: $VM_IP"
else
  echo "🔍 VM IP: $VM_IP"
fi

echo "🔧 Установка роли ADMIN для пользователя egor на VM: $VM_IP"
echo ""

# Пробуем разные пользователи и ключи
for USER in ubuntu root; do
  for KEY in ~/.ssh/id_rsa ~/.ssh/id_ed25519 ~/.ssh/yandex_key ~/.ssh/event_app_key ~/.ssh/yandex_cloud_key; do
    if [ -f "$KEY" ]; then
      echo "Пробую подключиться как $USER с ключом $KEY..."
      scp -i "$KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no server/scripts/set-egor-admin.js $USER@$VM_IP:/tmp/ 2>/dev/null && {
        echo "✅ Скрипт скопирован!"
        ssh -i "$KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no $USER@$VM_IP << 'ENDSSH'
cd /home/ubuntu/event_app_new/server 2>/dev/null || cd /root/server 2>/dev/null || cd /home/ubuntu/server 2>/dev/null || cd /app/server 2>/dev/null || cd /var/www/server 2>/dev/null || exit 1
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  cd /tmp
  node set-egor-admin.js
  rm set-egor-admin.js
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

