#!/bin/bash

# Автоматическая настройка Railway через CLI

set -e

echo "🚂 Автоматическая настройка Railway..."
echo ""

cd "$(dirname "$0")" || exit 1

# Добавляем Railway CLI в PATH
export PATH="$HOME/.railway/bin:$PATH"

# Установка Railway CLI
if ! command -v railway &> /dev/null; then
    echo "📦 Устанавливаем Railway CLI..."
    curl -fsSL https://railway.app/install.sh | sh
    export PATH="$HOME/.railway/bin:$PATH"
    echo "✅ Railway CLI установлен"
    echo ""
fi

echo "🔐 Проверяем авторизацию..."
if ! railway whoami &> /dev/null; then
    echo "⚠️  Требуется авторизация через браузер"
    echo "   Запустите: railway login"
    echo "   Затем запустите этот скрипт снова"
    exit 1
fi

echo "✅ Авторизован как: $(railway whoami)"
echo ""

# Переходим в папку server
cd server || exit 1

echo "📋 Инициализация проекта..."
echo "   Если проект уже существует, выберите 'Link to existing project'"
railway init || {
    echo "⚠️  Инициализация прервана или проект уже настроен"
}

echo ""
echo "🔧 Настройка переменных окружения..."

# Обязательные переменные
railway variables set NODE_ENV=production
railway variables set PORT=4000
railway variables set CORS_ORIGIN=*

# JWT секреты
railway variables set JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE=
railway variables set JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8=
railway variables set JWT_ACCESS_TTL=15m
railway variables set JWT_REFRESH_TTL=7d

# API URL
railway variables set APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app

echo ""
echo "✅ Переменные установлены"
echo ""
echo "📝 Проверка переменных:"
railway variables

echo ""
echo "🚀 Деплой..."
echo "   Railway автоматически задеплоит при следующем push в GitHub"
echo "   Или запустите: railway up"
echo ""

