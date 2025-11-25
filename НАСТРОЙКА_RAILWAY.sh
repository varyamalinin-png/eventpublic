#!/bin/bash

# Полная настройка Railway - выполните этот скрипт

set -e

echo "🚂 Настройка Railway..."
echo ""

cd "$(dirname "$0")/server" || exit 1

RAILWAY="npx -y @railway/cli"

# Шаг 1: Авторизация
echo "📋 Шаг 1: Авторизация"
if ! $RAILWAY whoami &> /dev/null 2>&1; then
    echo "   ⚠️  Требуется авторизация"
    echo "   Выполняю: $RAILWAY login"
    echo "   Откроется браузер - авторизуйтесь через GitHub"
    echo ""
    $RAILWAY login
    echo ""
else
    echo "   ✅ Уже авторизован: $($RAILWAY whoami 2>&1 | head -1)"
    echo ""
fi

# Шаг 2: Инициализация
echo "📋 Шаг 2: Инициализация проекта"
if [ ! -f ".railway/config.toml" ]; then
    echo "   Инициализирую проект..."
    echo "   Выберите: 'Link to existing project' → выберите ваш проект"
    echo ""
    $RAILWAY init
    echo ""
else
    echo "   ✅ Проект уже инициализирован"
    echo ""
fi

# Шаг 3: Установка переменных
echo "📋 Шаг 3: Установка переменных окружения"
echo ""

$RAILWAY variables set NODE_ENV=production
$RAILWAY variables set PORT=4000
$RAILWAY variables set CORS_ORIGIN=*
$RAILWAY variables set JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE=
$RAILWAY variables set JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8=
$RAILWAY variables set JWT_ACCESS_TTL=15m
$RAILWAY variables set JWT_REFRESH_TTL=7d
$RAILWAY variables set APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app

echo ""
echo "✅ Переменные установлены"
echo ""

# Проверка
echo "📝 Проверка переменных:"
$RAILWAY variables

echo ""
echo "🎉 Готово!"
echo ""
echo "⚠️  ВАЖНО: В Railway веб-интерфейсе (https://railway.app):"
echo "   1. Откройте backend сервис (или создайте через 'GitHub Repo')"
echo "   2. Settings → Source → Root Directory = 'server'"
echo "   3. Проверьте, что DATABASE_URL и REDIS_URL автоматически связаны"
echo "   4. Запушьте код: git push"
echo ""

