#!/bin/bash

# Скрипт для правильной сборки iOS приложения с встроенным JS bundle

set -e

echo "🔨 Сборка iOS приложения iwent..."

cd "$(dirname "$0")/.."

# Проверяем наличие node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден!"
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"

# Экспортируем JS bundle для встраивания
echo "📦 Экспортируем JS bundle..."
npx expo export --platform ios --output-dir ios-build

# Копируем bundle в правильное место
if [ -d "ios-build/_expo/static/js" ]; then
    echo "✅ JS bundle экспортирован"
else
    echo "⚠️  JS bundle не найден, будет использован Metro bundler"
fi

echo ""
echo "✅ Готово к сборке в Xcode!"
echo ""
echo "📱 Инструкции:"
echo "1. Откройте ios/iwent.xcworkspace в Xcode"
echo "2. Выберите ваше устройство"
echo "3. Выберите схему 'iwent' > Edit Scheme"
echo "4. Установите Build Configuration = 'Release'"
echo "5. Нажмите Cmd+B для сборки"
echo ""
echo "Или используйте команду:"
echo "   npx expo run:ios --configuration Release --device"

