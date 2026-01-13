#!/bin/bash

# Скрипт для сборки standalone iOS приложения с встроенным bundle

set -e

echo "🔨 Сборка standalone iOS приложения iwent..."

cd "$(dirname "$0")/.."

# 1. Экспортируем JS bundle
echo "📦 Экспортируем JS bundle..."
npx expo export --platform ios --output-dir ios-build

# 2. Копируем bundle в проект
echo "📋 Копируем bundle в проект..."
mkdir -p ios/iwent
BUNDLE_FILE=$(find ios-build/_expo/static/js/ios -name "*.hbc" | head -1)
if [ -f "$BUNDLE_FILE" ]; then
    cp "$BUNDLE_FILE" ios/iwent/main.jsbundle
    echo "✅ Bundle скопирован: ios/iwent/main.jsbundle ($(du -h ios/iwent/main.jsbundle | cut -f1))"
else
    echo "❌ Bundle не найден!"
    exit 1
fi

echo ""
echo "✅ Готово! Теперь в Xcode:"
echo "1. Откройте ios/iwent.xcworkspace"
echo "2. Добавьте main.jsbundle в проект (если еще не добавлен)"
echo "3. Выберите схему 'iwent' > Edit Scheme"
echo "4. Установите Build Configuration = 'Release'"
echo "5. Выберите ваше устройство"
echo "6. Нажмите Cmd+R для запуска"
echo ""
echo "Или используйте команду:"
echo "   npx expo run:ios --configuration Release --device"

