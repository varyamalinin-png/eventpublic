#!/bin/bash

# Скрипт для настройки иконки приложения iwent
# Требуется: исходный файл icon.png (1024x1024) в папке assets/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$PROJECT_ROOT/assets"

echo "🎨 Настройка иконки приложения iwent..."

# Проверяем наличие исходного файла
if [ ! -f "$ASSETS_DIR/icon.png" ]; then
    echo "❌ Файл $ASSETS_DIR/icon.png не найден!"
    echo "📝 Пожалуйста, поместите ваш логотип в assets/icon.png (1024x1024 PNG)"
    exit 1
fi

# Проверяем размер файла (должен быть больше заглушки)
FILE_SIZE=$(stat -f%z "$ASSETS_DIR/icon.png" 2>/dev/null || stat -c%s "$ASSETS_DIR/icon.png" 2>/dev/null)
if [ "$FILE_SIZE" -lt 1000 ]; then
    echo "⚠️  Внимание: файл icon.png очень маленький ($FILE_SIZE байт)"
    echo "📝 Убедитесь, что вы загрузили правильный файл логотипа"
fi

echo "✅ Файл icon.png найден"

# Копируем иконку для адаптивного иконка Android (если нужно)
if [ ! -f "$ASSETS_DIR/adaptive-icon.png" ] || [ "$(stat -f%z "$ASSETS_DIR/adaptive-icon.png" 2>/dev/null || stat -c%s "$ASSETS_DIR/adaptive-icon.png" 2>/dev/null)" -lt 1000 ]; then
    echo "📱 Создаю adaptive-icon.png для Android..."
    cp "$ASSETS_DIR/icon.png" "$ASSETS_DIR/adaptive-icon.png"
fi

# Копируем для splash screen (если нужно)
if [ ! -f "$ASSETS_DIR/splash-icon.png" ] || [ "$(stat -f%z "$ASSETS_DIR/splash-icon.png" 2>/dev/null || stat -c%s "$ASSETS_DIR/splash-icon.png" 2>/dev/null)" -lt 1000 ]; then
    echo "🖼️  Создаю splash-icon.png..."
    cp "$ASSETS_DIR/icon.png" "$ASSETS_DIR/splash-icon.png"
fi

# Копируем для favicon (если нужно)
if [ ! -f "$ASSETS_DIR/favicon.png" ] || [ "$(stat -f%z "$ASSETS_DIR/favicon.png" 2>/dev/null || stat -c%s "$ASSETS_DIR/favicon.png" 2>/dev/null)" -lt 1000 ]; then
    echo "🌐 Создаю favicon.png..."
    cp "$ASSETS_DIR/icon.png" "$ASSETS_DIR/favicon.png"
fi

echo ""
echo "✅ Иконки настроены!"
echo ""
echo "📱 Следующие шаги:"
echo "   1. Выполните: npx expo prebuild"
echo "   2. Это автоматически создаст все необходимые размеры иконок для iOS и Android"
echo ""
echo "   Или пересоберите приложение:"
echo "   - iOS: npx expo run:ios"
echo "   - Android: npx expo run:android"

