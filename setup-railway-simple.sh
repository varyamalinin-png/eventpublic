#!/bin/bash

# Простая настройка Railway через npx (без установки)

set -e

echo "🚂 Настройка Railway через npx..."
echo ""

cd "$(dirname "$0")/server" || exit 1

# Используем npx для запуска Railway CLI без установки
RAILWAY_CMD="npx -y @railway/cli"

echo "📋 Шаг 1: Авторизация"
echo "   Откроется браузер - авторизуйтесь через GitHub"
echo ""
$RAILWAY_CMD login

echo ""
echo "📋 Шаг 2: Инициализация проекта"
echo "   Выберите: 'Link to existing project' → выберите ваш проект"
echo ""
$RAILWAY_CMD init

echo ""
echo "📋 Шаг 3: Установка переменных окружения"
echo ""

$RAILWAY_CMD variables set NODE_ENV=production
$RAILWAY_CMD variables set PORT=4000
$RAILWAY_CMD variables set CORS_ORIGIN=*
$RAILWAY_CMD variables set JWT_ACCESS_SECRET=EIGUZBTMbqW2OD2my1Gk9qUdVs3XFo5MgI1YY1aXYTE=
$RAILWAY_CMD variables set JWT_REFRESH_SECRET=oBo5isGfN6UoUEG+cXl1GJDHBpU6RuGoOvyiAWhX2E8=
$RAILWAY_CMD variables set JWT_ACCESS_TTL=15m
$RAILWAY_CMD variables set JWT_REFRESH_TTL=7d
$RAILWAY_CMD variables set APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app

echo ""
echo "✅ Переменные установлены"
echo ""
echo "📝 Проверка переменных:"
$RAILWAY_CMD variables

echo ""
echo "⚠️  ВАЖНО:"
echo "   1. В Railway веб-интерфейсе установите Root Directory = 'server'"
echo "   2. Проверьте, что DATABASE_URL и REDIS_URL присутствуют в переменных"
echo "   3. Запушьте код: git push"
echo ""

