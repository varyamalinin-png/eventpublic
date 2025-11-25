#!/bin/bash

# Скрипт для настройки Railway через CLI

echo "🚂 Настройка Railway через CLI..."
echo ""

cd "$(dirname "$0")/server" || exit 1

# Проверяем установку Railway CLI
if ! command -v railway &> /dev/null; then
    echo "📦 Устанавливаем Railway CLI..."
    curl -fsSL https://railway.app/install.sh | sh
    echo ""
    echo "⚠️  Перезапустите терминал после установки"
    echo "   Затем запустите: railway login"
    exit 1
fi

echo "✅ Railway CLI установлен"
echo ""

# Проверяем авторизацию
if ! railway whoami &> /dev/null; then
    echo "🔐 Авторизация..."
    railway login
fi

echo ""
echo "📋 Доступные команды:"
echo ""
echo "1. Инициализация проекта:"
echo "   railway init"
echo ""
echo "2. Создание сервиса:"
echo "   railway up"
echo ""
echo "3. Просмотр переменных:"
echo "   railway variables"
echo ""
echo "4. Добавление переменных:"
echo "   railway variables set NODE_ENV=production"
echo ""
echo "5. Подключение базы данных:"
echo "   railway link <database-service-id>"
echo ""
echo "6. Просмотр логов:"
echo "   railway logs"
echo ""
echo "📖 Полная инструкция: cat ../RAILWAY_CLI.md"

