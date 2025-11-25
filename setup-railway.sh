#!/bin/bash

# Автоматическая настройка Railway

set -e

echo "🚂 Настройка Railway..."
echo ""

cd "$(dirname "$0")" || exit 1

# Устанавливаем Railway CLI в домашнюю директорию
INSTALL_DIR="$HOME/.local/bin"
export PATH="$INSTALL_DIR:$PATH"

if ! command -v railway &> /dev/null; then
    echo "📦 Устанавливаем Railway CLI..."
    mkdir -p "$INSTALL_DIR"
    curl -fsSL https://railway.app/install.sh | bash -s -- --install-dir "$INSTALL_DIR"
    echo "✅ Railway CLI установлен в $INSTALL_DIR"
    echo ""
    echo "⚠️  Добавьте в ~/.zshrc:"
    echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
fi

# Проверяем авторизацию
if ! railway whoami &> /dev/null 2>&1; then
    echo "🔐 Требуется авторизация..."
    echo "   Запустите команду: railway login"
    echo "   Затем запустите этот скрипт снова"
    exit 1
fi

echo "✅ Авторизован: $(railway whoami)"
echo ""

# Переходим в server
cd server || exit 1

echo "📋 Доступные команды:"
echo ""
echo "1. Инициализация проекта:"
echo "   railway init"
echo ""
echo "2. Установка переменных:"
echo "   railway variables set NODE_ENV=production"
echo "   railway variables set PORT=4000"
echo "   railway variables set CORS_ORIGIN=*"
echo "   railway variables set JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE="
echo "   railway variables set JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8="
echo "   railway variables set JWT_ACCESS_TTL=15m"
echo "   railway variables set JWT_REFRESH_TTL=7d"
echo "   railway variables set APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app"
echo ""
echo "3. Проверка переменных:"
echo "   railway variables"
echo ""
echo "4. Деплой:"
echo "   railway up"
echo ""
echo "5. Логи:"
echo "   railway logs"
echo ""

