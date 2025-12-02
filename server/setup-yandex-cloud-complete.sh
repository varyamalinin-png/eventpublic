#!/bin/bash
# Полностью автоматизированная настройка Yandex Cloud
# Запустите этот скрипт после авторизации: yc init

set -e

echo "🚀 Полная автоматизация настройки Yandex Cloud"
echo "=============================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка установки Yandex Cloud CLI
if ! command -v yc &> /dev/null; then
    echo -e "${RED}❌ Yandex Cloud CLI не установлен!${NC}"
    echo ""
    echo "📥 Установка Yandex Cloud CLI..."
    
    # Установка для macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            echo "Устанавливаю через Homebrew..."
            brew install yandex-cloud-cli
        else
            echo "Устанавливаю через curl..."
            curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
            export PATH=$PATH:$HOME/yandex-cloud/bin
        fi
    else
        echo "Устанавливаю через curl..."
        curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
        export PATH=$PATH:$HOME/yandex-cloud/bin
    fi
    
    echo -e "${GREEN}✅ Yandex Cloud CLI установлен${NC}"
    echo ""
fi

# Проверка авторизации
echo "🔍 Проверка авторизации..."
if ! yc config list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Не авторизованы в Yandex Cloud CLI${NC}"
    echo ""
    echo "🔐 Запустите авторизацию:"
    echo "   yc init"
    echo ""
    echo "Или используйте сервисный аккаунт:"
    echo "   yc config set service-account-key <путь-к-ключу.json>"
    echo ""
    exit 1
fi

# Получение информации о конфигурации
FOLDER_ID=$(yc config get folder-id 2>/dev/null || echo "")
CLOUD_ID=$(yc config get cloud-id 2>/dev/null || echo "")

if [ -z "$FOLDER_ID" ]; then
    echo -e "${RED}❌ Каталог не настроен!${NC}"
    echo "Запустите: yc init"
    exit 1
fi

echo -e "${GREEN}✅ Yandex Cloud CLI настроен${NC}"
echo "📁 Каталог: $FOLDER_ID"
echo "☁️  Облако: $CLOUD_ID"
echo ""

# Получение SSH ключа
SSH_KEY="${HOME}/.ssh/id_rsa.pub"
if [ ! -f "$SSH_KEY" ]; then
    SSH_KEY="${HOME}/.ssh/yandex-cloud.pub"
    if [ ! -f "$SSH_KEY" ]; then
        echo -e "${YELLOW}⚠️  SSH ключ не найден, создаю новый...${NC}"
        ssh-keygen -t rsa -b 4096 -f "${HOME}/.ssh/yandex-cloud" -N "" -C "yandex-cloud-vm"
        SSH_KEY="${HOME}/.ssh/yandex-cloud.pub"
    fi
fi

SSH_PUBLIC_KEY=$(cat "$SSH_KEY")
echo -e "${GREEN}✅ SSH ключ найден: $SSH_KEY${NC}"
echo ""

# Функция для ожидания готовности VM
wait_for_vm() {
    local vm_id=$1
    echo "⏳ Ожидание запуска VM..."
    for i in {1..30}; do
        status=$(yc compute instance get $vm_id --format json 2>/dev/null | jq -r '.status' || echo "UNKNOWN")
        if [ "$status" = "RUNNING" ]; then
            echo -e "${GREEN}✅ VM запущена${NC}"
            return 0
        fi
        echo "   Попытка $i/30: статус = $status"
        sleep 5
    done
    echo -e "${RED}❌ VM не запустилась за отведенное время${NC}"
    return 1
}

# Функция для ожидания доступности SSH
wait_for_ssh() {
    local ip=$1
    echo "⏳ Ожидание доступности SSH на $ip..."
    for i in {1..30}; do
        if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ubuntu@$ip "echo 'OK'" &>/dev/null; then
            echo -e "${GREEN}✅ SSH доступен${NC}"
            return 0
        fi
        echo "   Попытка $i/30..."
        sleep 5
    done
    echo -e "${YELLOW}⚠️  SSH пока недоступен, продолжаем...${NC}"
    return 0
}

# Создание VM
echo "🖥️  Создание виртуальной машины..."
echo "   Имя: event-app-backend"
echo "   Зона: ru-central1-b"
echo "   vCPU: 2, RAM: 4GB"
echo "   Диск: 20GB"
echo ""

# Получить ID подсети
SUBNET_ID=$(yc vpc subnet get default-ru-central1-b --format json 2>/dev/null | jq -r '.id' || echo "")

if [ -z "$SUBNET_ID" ]; then
    echo "📡 Создание подсети..."
    yc vpc subnet create \
        --name default-ru-central1-b \
        --zone ru-central1-b \
        --network-name default \
        --range 10.129.0.0/24 || echo "Подсеть уже существует"
    SUBNET_ID=$(yc vpc subnet get default-ru-central1-b --format json | jq -r '.id')
fi

echo "Создание VM..."
VM_OUTPUT=$(yc compute instance create \
    --name event-app-backend \
    --zone ru-central1-b \
    --network-interface subnet-name=default-ru-central1-b,nat-ip-version=ipv4 \
    --create-boot-disk image-folder-id=standard-images,image-family=ubuntu-2204-lts,size=20 \
    --ssh-key "$SSH_PUBLIC_KEY" \
    --cores 2 \
    --memory 4GB \
    --format json 2>&1)

if echo "$VM_OUTPUT" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠️  VM уже существует${NC}"
    VM_ID=$(yc compute instance get event-app-backend --format json | jq -r '.id')
else
    VM_ID=$(echo "$VM_OUTPUT" | jq -r '.id')
fi

if [ -z "$VM_ID" ] || [ "$VM_ID" = "null" ]; then
    echo -e "${RED}❌ Ошибка создания VM${NC}"
    echo "$VM_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ VM создана: $VM_ID${NC}"

# Получить публичный IP
VM_IP=$(yc compute instance get $VM_ID --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
echo -e "${GREEN}🌐 Публичный IP: $VM_IP${NC}"

# Сохранить информацию
echo "$VM_IP" > /tmp/yandex-vm-ip.txt
echo "$VM_ID" > /tmp/yandex-vm-id.txt

# Ожидание запуска VM
wait_for_vm $VM_ID

# Ожидание доступности SSH
sleep 30  # Дополнительное время для инициализации
wait_for_ssh $VM_IP

# Настройка VM
echo ""
echo "🔧 Настройка VM..."
echo ""

# Загрузить скрипт настройки
echo "📤 Загрузка скрипта настройки на VM..."
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null server/yandex-cloud-setup.sh ubuntu@$VM_IP:/tmp/setup.sh 2>/dev/null || {
    echo "⚠️  Не удалось загрузить через SCP, используем встроенный скрипт..."
    
    # Альтернатива: выполнить команды напрямую через SSH
    ssh -o StrictHostKeyChecking=no ubuntu@$VM_IP << 'ENDSSH'
set -e
echo "🚀 Настройка приложения на Yandex Cloud..."

# Обновление системы
echo "📦 Обновление системы..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# Установка Node.js 18
echo "📦 Установка Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - > /dev/null
sudo apt-get install -y nodejs -qq

# Установка PM2
echo "📦 Установка PM2..."
sudo npm install -g pm2 -q

# Установка Git и других инструментов
echo "📦 Установка инструментов..."
sudo apt-get install -y git postgresql-client redis-server -qq
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Создание директории
echo "📁 Создание директории..."
sudo mkdir -p /opt/event-app
sudo chown -R ubuntu:ubuntu /opt/event-app

# Клонирование репозитория
echo "📥 Клонирование репозитория..."
cd /opt/event-app
git clone https://github.com/varyamalinin-png/eventpublic.git . || echo "Репозиторий уже клонирован"

echo "✅ Базовая настройка завершена!"
ENDSSH
}

# Запуск полной настройки
echo "🚀 Запуск полной настройки приложения..."
ssh -o StrictHostKeyChecking=no ubuntu@$VM_IP << 'ENDSSH'
set -e
cd /opt/event-app/server

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install --legacy-peer-deps

# Генерация Prisma клиента
echo "🔧 Генерация Prisma клиента..."
npm run prisma:generate

# Сборка приложения
echo "🔨 Сборка приложения..."
npm run build

# Создание PM2 конфигурации
cat > ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'event-app-backend',
    script: 'dist/src/main.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
}
EOFPM2

mkdir -p logs

# Настройка автозапуска PM2
pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save

echo "✅ Приложение настроено!"
ENDSSH

echo ""
echo -e "${GREEN}✅ ВСЕ ГОТОВО!${NC}"
echo ""
echo "📝 Информация:"
echo "   VM ID: $VM_ID"
echo "   Публичный IP: $VM_IP"
echo ""
echo "🔗 Подключение:"
echo "   ssh ubuntu@$VM_IP"
echo ""
echo "📋 Следующие шаги:"
echo "1. Подключитесь: ssh ubuntu@$VM_IP"
echo "2. Настройте переменные окружения:"
echo "   cd /opt/event-app/server"
echo "   cp yandex-cloud-env-template.env .env"
echo "   nano .env"
echo "3. Запустите миграции: npm run prisma:deploy"
echo "4. Запустите приложение: pm2 start ecosystem.config.js"
echo ""
echo "💾 Информация сохранена в:"
echo "   /tmp/yandex-vm-ip.txt"
echo "   /tmp/yandex-vm-id.txt"

