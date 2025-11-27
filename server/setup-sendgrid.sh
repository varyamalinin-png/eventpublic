#!/bin/bash

# Скрипт для быстрой настройки SendGrid в Railway
echo "📧 Настройка SendGrid для Railway"
echo ""
read -sp "Введите SENDGRID_API_KEY (начинается с SG.): " SENDGRID_API_KEY
echo ""
echo ""
read -p "Email отправителя (Enter для использования varya.malinin@gmail.com): " FROM_EMAIL
FROM_EMAIL=${FROM_EMAIL:-varya.malinin@gmail.com}

echo ""
echo "Добавляю переменные в Railway..."
npx -y @railway/cli variables --service eventpublic \
  --set "SENDGRID_API_KEY=$SENDGRID_API_KEY" \
  --set "SENDGRID_FROM_EMAIL=$FROM_EMAIL"

echo ""
echo "✅ SendGrid настроен!"
echo "Перезапустите сервис в Railway для применения изменений."
