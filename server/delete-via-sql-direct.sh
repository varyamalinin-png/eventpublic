#!/bin/bash
# Прямое выполнение SQL через Railway

echo "Удаляю всех пользователей через SQL..."

# Пробуем через Railway connect
echo 'DELETE FROM "User";' | npx -y @railway/cli connect postgres 2>&1 || echo "Не удалось"

