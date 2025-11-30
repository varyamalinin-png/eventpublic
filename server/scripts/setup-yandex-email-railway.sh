#!/bin/bash

# Скрипт для настройки Yandex Cloud Email API переменных в Railway
# Использование: ./scripts/setup-yandex-email-railway.sh

set -e

echo "🚀 Настройка Yandex Cloud Email API для Railway"
echo "================================================"
echo ""

# Проверяем наличие Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI не установлен!"
    echo "Установите Railway CLI: npm install -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI найден"
echo ""

# Получаем IAM токен
echo "🔐 Получение IAM токена..."
IAM_TOKEN=$(node scripts/get-yandex-iam-token.js 2>/dev/null | grep "YANDEX_IAM_TOKEN=" | cut -d'=' -f2-)

if [ -z "$IAM_TOKEN" ]; then
    echo "❌ Не удалось получить IAM токен"
    echo "Запустите вручную: node scripts/get-yandex-iam-token.js"
    exit 1
fi

echo "✅ IAM токен получен"
echo ""

# Значения по умолчанию
FROM_EMAIL="${YANDEX_CLOUD_FROM_EMAIL:-noreply@iventapp.ru}"
SERVICE_NAME="${RAILWAY_SERVICE:-eventpublic}"

echo "📝 Настройка переменных окружения в Railway"
echo "   Сервис: $SERVICE_NAME"
echo "   Email отправителя: $FROM_EMAIL"
echo ""

# Устанавливаем переменные
echo "1. Установка YANDEX_IAM_TOKEN..."
railway variables set YANDEX_IAM_TOKEN="$IAM_TOKEN" --service "$SERVICE_NAME"

echo ""
echo "2. Установка YANDEX_CLOUD_FROM_EMAIL..."
railway variables set YANDEX_CLOUD_FROM_EMAIL="$FROM_EMAIL" --service "$SERVICE_NAME"

echo ""
echo "3. Установка YANDEX_CLOUD_API_ENDPOINT (опционально)..."
railway variables set YANDEX_CLOUD_API_ENDPOINT="https://mail-api.cloud.yandex.net" --service "$SERVICE_NAME" || true

echo ""
echo "✅ Все переменные установлены!"
echo ""
echo "📋 Установленные переменные:"
railway variables --service "$SERVICE_NAME" | grep -E "(YANDEX|EMAIL)" || echo "   (используйте 'railway variables' для просмотра)"
echo ""
echo "⚠️  ВАЖНО:"
echo "   1. IAM токен действителен 12 часов!"
echo "   2. Настройте автоматическое обновление токена для продакшена"
echo "   3. Убедитесь, что домен $FROM_EMAIL подтвержден в Yandex Cloud"
echo "   4. Перезапустите сервис в Railway для применения изменений"
echo ""

