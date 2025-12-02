#!/bin/bash
# Скрипт для настройки приложения на Yandex Cloud VM

set -e

echo "🚀 Настройка приложения на Yandex Cloud..."

# Обновление системы
echo "📦 Обновление системы..."
sudo apt-get update
sudo apt-get upgrade -y

# Установка Node.js 18
echo "📦 Установка Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2
echo "📦 Установка PM2..."
sudo npm install -g pm2

# Установка PostgreSQL клиента (для миграций)
echo "📦 Установка PostgreSQL клиента..."
sudo apt-get install -y postgresql-client

# Установка Redis (если не используете Managed Redis)
echo "📦 Установка Redis..."
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Создание директории для приложения
echo "📁 Создание директории для приложения..."
sudo mkdir -p /opt/event-app
sudo chown -R $USER:$USER /opt/event-app

# Установка Git (если еще не установлен)
echo "📦 Установка Git..."
sudo apt-get install -y git

# Клонирование репозитория
echo "📥 Клонирование репозитория..."
cd /opt/event-app
if [ ! -d ".git" ]; then
    git clone https://github.com/varyamalinin-png/eventpublic.git .
fi

# Установка зависимостей
echo "📦 Установка зависимостей..."
cd /opt/event-app/server
npm install --legacy-peer-deps

# Генерация Prisma клиента
echo "🔧 Генерация Prisma клиента..."
npm run prisma:generate

# Сборка приложения
echo "🔨 Сборка приложения..."
npm run build

# Создание PM2 конфигурации
echo "⚙️ Создание PM2 конфигурации..."
cat > /opt/event-app/server/ecosystem.config.js << 'EOF'
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
EOF

# Создание директории для логов
mkdir -p /opt/event-app/server/logs

# Настройка автозапуска PM2
echo "⚙️ Настройка автозапуска PM2..."
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

echo "✅ Настройка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Настройте переменные окружения в /opt/event-app/server/.env"
echo "2. Запустите миграции: cd /opt/event-app/server && npm run prisma:deploy"
echo "3. Запустите приложение: pm2 start ecosystem.config.js"
echo "4. Проверьте статус: pm2 status"

