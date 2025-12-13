#!/bin/bash
# Скрипт для очистки кеша Expo и Metro

echo "🧹 Очищаю кеш Expo и Metro..."

# Очищаем кеш Expo
rm -rf .expo
echo "✅ Очищен кеш .expo"

# Очищаем кеш Metro
rm -rf .metro-cache
echo "✅ Очищен кеш .metro-cache"

# Очищаем кеш npm (опционально)
# npm cache clean --force

# Очищаем watchman (если установлен)
if command -v watchman &> /dev/null; then
  watchman watch-del-all
  echo "✅ Очищен кеш watchman"
fi

echo ""
echo "✅ Кеш очищен! Теперь запустите: npm start"
