#!/bin/bash
# Удаление пользователей через railway connect
echo "Подключаюсь к PostgreSQL и удаляю пользователей..."
echo 'DELETE FROM "User"; SELECT COUNT(*) FROM "User";' | npx -y @railway/cli connect postgres
