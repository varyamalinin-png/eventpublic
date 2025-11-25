#!/bin/bash

# Скрипт для подготовки проекта к деплою на Railway

echo "🚀 Подготовка к деплою на Railway..."
echo ""

cd "$(dirname "$0")/server" || exit 1

echo "1️⃣ Проверяем наличие необходимых файлов..."

# Проверяем package.json
if [ ! -f "package.json" ]; then
    echo "❌ package.json не найден"
    exit 1
fi

echo "✅ package.json найден"

# Проверяем наличие build скрипта
if ! grep -q '"build"' package.json; then
    echo "⚠️  Скрипт 'build' не найден в package.json"
fi

echo ""
echo "2️⃣ Создаем railway.json (если нужно)..."

cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run prisma:generate && npm run build"
  },
  "deploy": {
    "startCommand": "npm run prisma:deploy && npm run start:prod",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

echo "✅ railway.json создан"

echo ""
echo "3️⃣ Проверяем переменные окружения..."

echo "📝 Необходимые переменные для Railway:"
echo ""
echo "Обязательные:"
echo "  - DATABASE_URL (создается автоматически при добавлении PostgreSQL)"
echo "  - REDIS_URL (создается автоматически при добавлении Redis)"
echo "  - JWT_ACCESS_SECRET (сгенерируйте случайную строку)"
echo "  - JWT_REFRESH_SECRET (сгенерируйте случайную строку)"
echo ""
echo "Опциональные:"
echo "  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD"
echo "  - STORAGE_* (для AWS S3 или другого хранилища)"
echo ""

echo "✅ Готово!"
echo ""
echo "📖 Следующие шаги:"
echo "   1. Откройте https://railway.app"
echo "   2. Создайте новый проект"
echo "   3. Подключите GitHub репозиторий"
echo "   4. Добавьте PostgreSQL и Redis"
echo "   5. Настройте переменные окружения"
echo "   6. Дождитесь деплоя"
echo ""
echo "📖 Подробная инструкция: cat ../DEPLOY_REMOTE.md"

