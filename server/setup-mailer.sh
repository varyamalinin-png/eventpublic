#!/bin/bash

# Скрипт для настройки Mailer в Railway
# Использование: ./setup-mailer.sh

echo "📧 Настройка Mailer для Railway"
echo ""

# Проверяем наличие Railway CLI
if ! command -v railway &> /dev/null; then
    echo "Устанавливаю Railway CLI..."
    npm install -g @railway/cli
fi

echo "Выберите вариант:"
echo "1. SMTP (Gmail/Yandex/Mail.ru)"
echo "2. SendGrid"
read -p "Ваш выбор (1 или 2): " choice

case $choice in
    1)
        echo ""
        echo "=== Настройка SMTP ==="
        read -p "SMTP_HOST (например, smtp.gmail.com): " SMTP_HOST
        read -p "SMTP_PORT (587 для TLS, 465 для SSL): " SMTP_PORT
        read -p "SMTP_USER (ваш email): " SMTP_USER
        read -sp "SMTP_PASSWORD (пароль приложения): " SMTP_PASSWORD
        echo ""
        read -p "SMTP_SECURE (true для 465, false для 587): " SMTP_SECURE
        
        echo ""
        echo "Добавляю переменные в Railway..."
        npx -y @railway/cli variables \
            --set "SMTP_HOST=$SMTP_HOST" \
            --set "SMTP_PORT=$SMTP_PORT" \
            --set "SMTP_USER=$SMTP_USER" \
            --set "SMTP_PASSWORD=$SMTP_PASSWORD" \
            --set "SMTP_SECURE=$SMTP_SECURE" \
            --service eventpublic
        
        echo "✅ SMTP переменные добавлены!"
        ;;
    2)
        echo ""
        echo "=== Настройка SendGrid ==="
        read -sp "SENDGRID_API_KEY: " SENDGRID_API_KEY
        echo ""
        read -p "SENDGRID_FROM_EMAIL: " SENDGRID_FROM_EMAIL
        
        echo ""
        echo "Добавляю переменные в Railway..."
        npx -y @railway/cli variables \
            --set "SENDGRID_API_KEY=$SENDGRID_API_KEY" \
            --set "SENDGRID_FROM_EMAIL=$SENDGRID_FROM_EMAIL" \
            --service eventpublic
        
        echo "✅ SendGrid переменные добавлены!"
        ;;
    *)
        echo "Неверный выбор"
        exit 1
        ;;
esac

echo ""
echo "Убеждаюсь, что APP_BACKEND_BASE_URL установлен..."
npx -y @railway/cli variables \
    --set "APP_BACKEND_BASE_URL=https://eventpublic-production.up.railway.app" \
    --service eventpublic

echo ""
echo "✅ Mailer настроен! Перезапустите сервис в Railway для применения изменений."

