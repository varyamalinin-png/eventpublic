#!/bin/bash
# Полностью автоматизированная настройка Yandex Cloud через CLI
# Требует: yc CLI установлен и авторизован

set -e

echo "🚀 Автоматическая настройка Yandex Cloud для Event App"
echo "=================================================="

# Проверка установки Yandex Cloud CLI
if ! command -v yc &> /dev/null; then
    echo "❌ Yandex Cloud CLI не установлен!"
    echo "📥 Установите: https://cloud.yandex.ru/docs/cli/quickstart"
    exit 1
fi

# Проверка авторизации
if ! yc config list &> /dev/null; then
    echo "❌ Не авторизованы в Yandex Cloud CLI!"
    echo "🔐 Запустите: yc init"
    exit 1
fi

echo "✅ Yandex Cloud CLI установлен и авторизован"
echo ""

# Получение информации о текущем каталоге
FOLDER_ID=$(yc config get folder-id)
CLOUD_ID=$(yc config get cloud-id)

echo "📁 Каталог: $FOLDER_ID"
echo "☁️  Облако: $CLOUD_ID"
echo ""

# Функция для создания VM
create_vm() {
    echo "🖥️  Создание виртуальной машины..."
    
    # Получить SSH ключ пользователя
    SSH_KEY="${HOME}/.ssh/id_rsa.pub"
    if [ ! -f "$SSH_KEY" ]; then
        SSH_KEY="${HOME}/.ssh/yandex-cloud.pub"
    fi
    
    if [ ! -f "$SSH_KEY" ]; then
        echo "❌ SSH ключ не найден!"
        echo "📝 Создайте ключ: ssh-keygen -t rsa -b 4096 -f ~/.ssh/yandex-cloud"
        exit 1
    fi
    
    SSH_PUBLIC_KEY=$(cat "$SSH_KEY")
    
    # Создать VM
    VM_ID=$(yc compute instance create \
        --name event-app-backend \
        --zone ru-central1-b \
        --network-interface subnet-name=default-ru-central1-b,nat-ip-version=ipv4 \
        --create-boot-disk image-folder-id=standard-images,image-family=ubuntu-2204-lts,size=20 \
        --ssh-key "$SSH_PUBLIC_KEY" \
        --cores 2 \
        --memory 4GB \
        --format json | jq -r '.id')
    
    echo "✅ VM создана: $VM_ID"
    
    # Получить публичный IP
    VM_IP=$(yc compute instance get $VM_ID --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
    echo "🌐 Публичный IP: $VM_IP"
    
    echo "$VM_IP" > /tmp/yandex-vm-ip.txt
    echo "$VM_ID" > /tmp/yandex-vm-id.txt
}

# Функция для создания Managed PostgreSQL
create_postgresql() {
    echo "🗄️  Создание Managed PostgreSQL..."
    
    # Генерация пароля
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Создать кластер (требует больше параметров, упрощенная версия)
    echo "⚠️  Создание Managed PostgreSQL требует больше настроек"
    echo "📝 Создайте вручную через Console или используйте команду:"
    echo ""
    echo "yc managed-postgresql cluster create \\"
    echo "  --name event-app-db \\"
    echo "  --network-name default \\"
    echo "  --host zone-id=ru-central1-b,subnet-id=<subnet-id> \\"
    echo "  --resource-preset s2.micro \\"
    echo "  --disk-size 10 \\"
    echo "  --user name=postgres,password=$DB_PASSWORD \\"
    echo "  --database name=event_app"
    echo ""
    
    echo "$DB_PASSWORD" > /tmp/yandex-db-password.txt
}

# Функция для создания Object Storage bucket
create_storage() {
    echo "📦 Создание Object Storage bucket..."
    
    # Создать bucket
    yc storage bucket create \
        --name event-app-media \
        --max-size 10737418240 || echo "⚠️  Bucket уже существует или ошибка"
    
    echo "✅ Bucket создан: event-app-media"
}

# Функция для настройки VM
setup_vm() {
    VM_IP=$(cat /tmp/yandex-vm-ip.txt 2>/dev/null || echo "")
    
    if [ -z "$VM_IP" ]; then
        echo "❌ IP адрес VM не найден!"
        return 1
    fi
    
    echo "🔧 Настройка VM ($VM_IP)..."
    echo "⏳ Подождите 1-2 минуты пока VM запустится..."
    sleep 60
    
    # Загрузить скрипт настройки на VM
    scp server/yandex-cloud-setup.sh ubuntu@$VM_IP:/tmp/setup.sh
    
    # Запустить скрипт на VM
    ssh ubuntu@$VM_IP "chmod +x /tmp/setup.sh && sudo /tmp/setup.sh"
    
    echo "✅ VM настроена!"
}

# Главное меню
echo "Выберите что создать:"
echo "1) Только VM"
echo "2) VM + PostgreSQL (частично)"
echo "3) VM + PostgreSQL + Storage"
echo "4) Настроить существующую VM"
echo ""
read -p "Ваш выбор (1-4): " choice

case $choice in
    1)
        create_vm
        echo ""
        read -p "Настроить VM автоматически? (y/n): " setup_choice
        if [ "$setup_choice" = "y" ]; then
            setup_vm
        fi
        ;;
    2)
        create_vm
        create_postgresql
        ;;
    3)
        create_vm
        create_postgresql
        create_storage
        ;;
    4)
        read -p "Введите IP адрес VM: " VM_IP
        echo "$VM_IP" > /tmp/yandex-vm-ip.txt
        setup_vm
        ;;
    *)
        echo "❌ Неверный выбор"
        exit 1
        ;;
esac

echo ""
echo "✅ Готово!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Подключитесь к VM: ssh ubuntu@$(cat /tmp/yandex-vm-ip.txt 2>/dev/null || echo '<IP>')"
echo "2. Настройте переменные окружения"
echo "3. Запустите приложение"

