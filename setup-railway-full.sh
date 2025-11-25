#!/bin/bash

# Полная автоматическая настройка Railway

set -e

echo "🚂 Полная настройка Railway..."
echo ""

cd "$(dirname "$0")" || exit 1

# Устанавливаем Railway CLI
INSTALL_DIR="$HOME/.railway/bin"
export PATH="$INSTALL_DIR:$PATH"

if ! command -v railway &> /dev/null; then
    echo "📦 Устанавливаем Railway CLI..."
    mkdir -p "$INSTALL_DIR"
    
    # Определяем архитектуру
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        ARCH_SUFFIX="arm64"
    else
        ARCH_SUFFIX="amd64"
    fi
    
    curl -fsSL "https://github.com/railwayapp/cli/releases/latest/download/railway-darwin-${ARCH_SUFFIX}" -o "$INSTALL_DIR/railway"
    chmod +x "$INSTALL_DIR/railway"
    echo "✅ Railway CLI установлен в $INSTALL_DIR"
    echo ""
fi

# Проверяем авторизацию
echo "🔐 Проверяем авторизацию..."
if ! railway whoami &> /dev/null 2>&1; then
    echo ""
    echo "⚠️  Требуется авторизация..."
    echo "   Запускаю: railway login"
    echo "   Откроется браузер - авторизуйтесь"
    echo ""
    railway login
    echo ""
fi

echo "✅ Авторизован: $(railway whoami)"
echo ""

# Переходим в server
cd server || exit 1

echo "📋 Инициализация проекта..."
echo "   Выберите: 'Link to existing project' (если проект уже есть)"
echo "   Или: 'Create new project' (если создаете новый)"
echo ""

# Инициализируем (без интерактивного режима, если возможно)
railway init --help > /dev/null 2>&1 || railway init

echo ""
echo "🔧 Устанавливаем переменные окружения..."
echo ""

# Обязательные переменные
railway variables set NODE_ENV=production || echo "⚠️  NODE_ENV уже установлен"
railway variables set PORT=4000 || echo "⚠️  PORT уже установлен"
railway variables set CORS_ORIGIN=* || echo "⚠️  CORS_ORIGIN уже установлен"

# JWT секреты
railway variables set JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE= || echo "⚠️  JWT_ACCESS_SECRET уже установлен"
railway variables set JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8= || echo "⚠️  JWT_REFRESH_SECRET уже установлен"
railway variables set JWT_ACCESS_TTL=15m || echo "⚠️  JWT_ACCESS_TTL уже установлен"
railway variables set JWT_REFRESH_TTL=7d || echo "⚠️  JWT_REFRESH_TTL уже установлен"

# API URL
railway variables set APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app || echo "⚠️  APP_BACKEND_BASE_URL уже установлен"

echo ""
echo "✅ Переменные установлены"
echo ""
echo "📝 Проверка переменных:"
railway variables

echo ""
echo "🔍 Проверка DATABASE_URL и REDIS_URL..."
if railway variables | grep -q "DATABASE_URL"; then
    echo "✅ DATABASE_URL найден"
else
    echo "⚠️  DATABASE_URL не найден - добавьте вручную из PostgreSQL сервиса"
fi

if railway variables | grep -q "REDIS_URL"; then
    echo "✅ REDIS_URL найден"
else
    echo "⚠️  REDIS_URL не найден - добавьте вручную из Redis сервиса"
fi

echo ""
echo "🚀 Следующие шаги:"
echo "   1. Убедитесь, что DATABASE_URL и REDIS_URL установлены"
echo "   2. В Railway веб-интерфейсе установите Root Directory = 'server'"
echo "   3. Запушьте код в GitHub: git push"
echo "   4. Railway автоматически задеплоит"
echo ""

