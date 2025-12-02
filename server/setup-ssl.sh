#!/bin/bash
# Скрипт для автоматической настройки SSL сертификата для iventapp.ru

set -e

echo "🔐 Настройка SSL сертификата для iventapp.ru"
echo "=============================================="
echo ""

# Проверка DNS
echo "1️⃣ Проверка DNS записей..."
if ! dig iventapp.ru +short | grep -q "89.169.173.152"; then
    echo "❌ ОШИБКА: DNS запись для iventapp.ru не указывает на 89.169.173.152"
    echo "   Текущий IP: $(dig iventapp.ru +short)"
    echo "   Пожалуйста, настройте DNS записи и подождите 5-10 минут"
    echo "   См. инструкции в DNS_SETUP_INSTRUCTIONS.md"
    exit 1
fi

if ! dig www.iventapp.ru +short | grep -q "89.169.173.152"; then
    echo "⚠️  ПРЕДУПРЕЖДЕНИЕ: DNS запись для www.iventapp.ru не указывает на 89.169.173.152"
    echo "   Текущий IP: $(dig www.iventapp.ru +short)"
    echo "   Рекомендуется добавить A запись для www"
fi

echo "✅ DNS записи настроены правильно"
echo ""

# Получение SSL сертификата
echo "2️⃣ Получение SSL сертификата от Let's Encrypt..."
sudo certbot --nginx -d iventapp.ru -d www.iventapp.ru --non-interactive --agree-tos --email noreply@iventapp.ru --redirect

if [ $? -eq 0 ]; then
    echo "✅ SSL сертификат успешно получен и настроен"
else
    echo "❌ Ошибка при получении SSL сертификата"
    exit 1
fi

echo ""

# Обновление конфигурации приложения
echo "3️⃣ Обновление конфигурации приложения..."
cd ~/event_app_new/server

# Создание бэкапа .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Обновление переменных окружения
sed -i 's|APP_BACKEND_BASE_URL=.*|APP_BACKEND_BASE_URL=https://iventapp.ru|' .env
sed -i 's|APP_FRONTEND_BASE_URL=.*|APP_FRONTEND_BASE_URL=https://iventapp.ru|' .env
sed -i 's|APP_URL=.*|APP_URL=https://iventapp.ru|' .env
sed -i 's|EMAIL_VERIFICATION_REDIRECT_URL=.*|EMAIL_VERIFICATION_REDIRECT_URL=https://iventapp.ru/auth/verify|' .env
sed -i 's|PASSWORD_RESET_REDIRECT_URL=.*|PASSWORD_RESET_REDIRECT_URL=https://iventapp.ru/auth/reset|' .env

echo "✅ Конфигурация обновлена"
echo ""

# Перезапуск приложения
echo "4️⃣ Перезапуск приложения..."
pm2 restart event-app

echo ""
echo "✅ Готово! SSL сертификат настроен и приложение перезапущено"
echo ""
echo "🌐 Проверьте работу:"
echo "   - https://iventapp.ru"
echo "   - https://iventapp.ru/api/auth/check-email-status"
echo ""
echo "📱 Не забудьте обновить мобильное приложение:"
echo "   - Измените apiUrl в client/app.json на https://iventapp.ru"
echo "   - Пересоберите приложение в Xcode"

