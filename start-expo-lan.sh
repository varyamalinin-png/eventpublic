#!/bin/bash
# Скрипт для запуска Expo с доступом по локальной сети

# Переходим в директорию скрипта (client/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "🚀 Запускаю Expo с доступом по локальной сети..."
echo "📱 MacBook IP: 100.114.37.214"
echo "📱 Телефон IP: 100.114.38.85"
echo "🌐 Роутер: 100.114.32.1"
echo ""
echo "После запуска Expo покажет QR-код и URL для подключения"
echo "Используйте URL вида: exp://100.114.37.214:8081"
echo ""
echo "📂 Рабочая директория: $(pwd)"
echo ""

# Используем --clear для очистки кеша при необходимости
# Для быстрого запуска используйте: npx expo start --lan --port 8081 --no-dev
npx expo start --lan --port 8081

