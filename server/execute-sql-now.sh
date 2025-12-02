#!/bin/bash
# Скрипт для выполнения SQL на Railway через Railway CLI

echo "Выполняю SQL для верификации пользователя на Railway..."

# Выполняем SQL через Railway CLI
echo "UPDATE \"User\" SET \"emailVerified\" = true WHERE email = 'varya.malinina.2003@mail.ru' OR id = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';" | \
npx -y @railway/cli connect postgres --service postgres 2>&1 || \
echo "Попробуем другой способ..."
