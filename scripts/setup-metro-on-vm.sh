#!/bin/bash

# Скрипт для настройки Metro bundler на виртуальной машине Яндекс.Облака

set -e

VM_IP="158.160.67.4"
VM_USER="ubuntu"
SSH_KEY="$HOME/.ssh/yandex-cloud"
PROJECT_DIR="/home/ubuntu/event_app_new"
METRO_PORT="8081"

echo "🚀 Настройка Metro bundler на VM ($VM_IP)..."

# Проверка SSH ключа
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH ключ не найден: $SSH_KEY"
    echo "Создайте ключ или укажите правильный путь"
    exit 1
fi

# Функция для выполнения команд на VM
run_on_vm() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VM_USER@$VM_IP" "$@"
}

echo ""
echo "1️⃣  Проверка подключения к VM..."
if ! run_on_vm "echo 'VM доступна'"; then
    echo "❌ Не удалось подключиться к VM"
    exit 1
fi
echo "✅ Подключение установлено"

echo ""
echo "2️⃣  Проверка Node.js на VM..."
if ! run_on_vm "command -v node > /dev/null 2>&1"; then
    echo "📦 Установка Node.js..."
    run_on_vm "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
else
    NODE_VERSION=$(run_on_vm "node --version")
    echo "✅ Node.js уже установлен: $NODE_VERSION"
fi

echo ""
echo "3️⃣  Создание директории проекта на VM..."
run_on_vm "mkdir -p $PROJECT_DIR"

echo ""
echo "4️⃣  Копирование проекта на VM..."
echo "⏳ Это может занять некоторое время..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'ios' \
    --exclude 'android' \
    --exclude 'web/.next' \
    --exclude '.expo' \
    -e "ssh -i $SSH_KEY" \
    ./ "$VM_USER@$VM_IP:$PROJECT_DIR/"

echo ""
echo "5️⃣  Установка зависимостей на VM..."
run_on_vm "cd $PROJECT_DIR && npm install"

echo ""
echo "6️⃣  Настройка firewall для порта $METRO_PORT..."
run_on_vm "sudo ufw allow $METRO_PORT/tcp 2>/dev/null || sudo iptables -I INPUT -p tcp --dport $METRO_PORT -j ACCEPT 2>/dev/null || echo 'Firewall настройка пропущена (может потребоваться ручная настройка в Яндекс.Облаке)'"

echo ""
echo "7️⃣  Создание systemd service для Metro bundler..."
run_on_vm "sudo bash -c 'cat > /etc/systemd/system/metro-bundler.service << \"EOFSERVICE\"
[Unit]
Description=Metro Bundler for React Native
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$PROJECT_DIR
Environment=\"NODE_ENV=development\"
Environment=\"EXPO_PUBLIC_API_URL=https://iventapp.ru\"
ExecStart=/usr/bin/npx expo start --lan --port $METRO_PORT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOFSERVICE
'"

echo ""
echo "8️⃣  Запуск Metro bundler на VM..."
run_on_vm "sudo systemctl daemon-reload"
run_on_vm "sudo systemctl enable metro-bundler"
run_on_vm "sudo systemctl restart metro-bundler"

echo ""
echo "9️⃣  Проверка статуса Metro bundler..."
sleep 3
if run_on_vm "sudo systemctl is-active --quiet metro-bundler"; then
    echo "✅ Metro bundler запущен на VM"
    echo "🌐 Доступен по адресу: http://$VM_IP:$METRO_PORT"
else
    echo "⚠️  Metro bundler не запустился автоматически"
    echo "Проверьте логи: ssh -i $SSH_KEY $VM_USER@$VM_IP 'sudo journalctl -u metro-bundler -n 50'"
    echo "Или запустите вручную: ssh -i $SSH_KEY $VM_USER@$VM_IP 'cd $PROJECT_DIR && npx expo start --host 0.0.0.0 --port $METRO_PORT'"
fi

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📱 Следующий шаг: Обновите конфигурацию iOS приложения"
echo "   для подключения к Metro bundler на VM ($VM_IP:$METRO_PORT)"

