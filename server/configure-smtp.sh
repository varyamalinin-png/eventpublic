#!/bin/bash
# Скрипт для настройки SMTP в Railway

echo "=== НАСТРОЙКА SMTP В RAILWAY ==="
echo ""
echo "Добавьте эти переменные окружения в Railway:"
echo ""
echo "SMTP_HOST=smtp.mail.ru"
echo "SMTP_PORT=587"
echo "SMTP_USER=ваш_email@mail.ru"
echo "SMTP_PASSWORD=пароль_приложения"
echo "SMTP_SECURE=false"
echo "EMAIL_VERIFICATION_REDIRECT_URL=https://eventpublic-production.up.railway.app/auth/verify-email"
echo ""
echo "Или выполните через Railway CLI:"
echo ""
echo "npx @railway/cli variables set SMTP_HOST=smtp.mail.ru --service eventpublic"
echo "npx @railway/cli variables set SMTP_PORT=587 --service eventpublic"
echo "npx @railway/cli variables set SMTP_SECURE=false --service eventpublic"
echo ""

