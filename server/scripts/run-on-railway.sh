#!/bin/bash
# Скрипт для выполнения на Railway через Railway CLI

echo "Выполняю верификацию пользователя на Railway..."

# Подключаемся к Railway и выполняем команду
npx -y @railway/cli run --service eventpublic node scripts/verify-user-now.js

echo "✅ Готово!"
