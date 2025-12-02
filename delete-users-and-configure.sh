#!/bin/bash
# Скрипт для удаления пользователей и настройки SMTP

echo "=== УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЕЙ И НАСТРОЙКА ==="

# Пробуем удалить через Railway CLI
echo "1. Удаляю всех пользователей..."
cd server && npx -y @railway/cli run --service eventpublic node scripts/delete-all-users-railway.js 2>&1 || echo "Не удалось через CLI"

# Показываем инструкцию для SQL
echo ""
echo "2. Если не сработало, выполните SQL в Railway:"
echo "   DELETE FROM \"User\";"
echo ""

