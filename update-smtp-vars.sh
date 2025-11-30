#!/bin/bash
# Скрипт для обновления SMTP переменных через Railway API

echo "Обновляю SMTP переменные для Mail.ru..."

# Пробуем через Railway CLI
npx -y @railway/cli variables --service eventpublic 2>&1 | grep SMTP

echo ""
echo "Для изменения используйте Railway Dashboard или:"
echo "railway variables set SMTP_HOST=smtp.mail.ru"
echo "railway variables set SMTP_PORT=587"
echo "railway variables set SMTP_SECURE=false"
echo "railway variables set SMTP_USER=varya.malinina.2003@mail.ru"

