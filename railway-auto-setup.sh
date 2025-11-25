#!/bin/bash

# Автоматическая настройка Railway (после авторизации)

set -e

echo "🚂 Автоматическая настройка Railway..."
echo ""

cd "$(dirname "$0")/server" || exit 1

# Используем npx для Railway CLI
RAILWAY="npx -y @railway/cli"

# Проверяем авторизацию
echo "🔐 Проверяем авторизацию..."
if ! $RAILWAY whoami &> /dev/null 2>&1; then
    echo ""
    echo "❌ Не авторизован!"
    echo ""
    echo "📋 Сначала авторизуйтесь:"
    echo "   $RAILWAY login"
    echo ""
    echo "   Затем запустите этот скрипт снова"
    exit 1
fi

USER=$( $RAILWAY whoami 2>&1 | head -1)
echo "✅ Авторизован: $USER"
echo ""

# Проверяем связь с проектом
echo "📋 Проверяем связь с проектом..."
if ! $RAILWAY status &> /dev/null 2>&1; then
    echo "   ❌ Не связан с проектом"
    echo "   Запустите: $RAILWAY link"
    echo "   Затем запустите этот скрипт снова"
    exit 1
fi

STATUS=$( $RAILWAY status 2>&1)
echo "✅ Связан с проектом:"
echo "$STATUS" | head -3
echo ""

# Устанавливаем переменные
echo "🔧 Устанавливаем переменные окружения..."
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

# Показываем все переменные
echo "📝 Текущие переменные:"
$RAILWAY variables

echo ""
echo "🔍 Проверка DATABASE_URL и REDIS_URL..."
VARS=$( $RAILWAY variables)
if echo "$VARS" | grep -q "DATABASE_URL"; then
    echo "✅ DATABASE_URL найден"
else
    echo "⚠️  DATABASE_URL НЕ найден - добавьте вручную из PostgreSQL сервиса"
fi

if echo "$VARS" | grep -q "REDIS_URL"; then
    echo "✅ REDIS_URL найден"
else
    echo "⚠️  REDIS_URL НЕ найден - добавьте вручную из Redis сервиса"
fi

echo ""
echo "🎉 Готово!"
echo ""
echo "⚠️  ВАЖНО: Проверьте в Railway веб-интерфейсе:"
echo "   1. Root Directory = 'server' (Settings → Source → Root Directory)"
echo "   2. DATABASE_URL и REDIS_URL должны быть автоматически связаны"
echo "   3. Запушьте код: git push (Railway автоматически задеплоит)"
echo ""

