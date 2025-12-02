#!/bin/bash
# Запуск автоматической настройки после авторизации

cd "$(dirname "$0")"

export PATH="/opt/homebrew/bin:$PATH"

echo "🚀 Запуск автоматической настройки Yandex Cloud"
echo "=============================================="
echo ""

# Проверка авторизации
if ! yc config list &> /dev/null; then
    echo "⚠️  Нужна авторизация в Yandex Cloud"
    echo ""
    echo "Запустите:"
    echo "  yc init"
    echo ""
    echo "Введите:"
    echo "  Логин: vsmalinina@edu.hse.ru"
    echo "  Пароль: %xxW1qblpN"
    echo "  Каталог: eventapp"
    echo ""
    echo "После авторизации запустите этот скрипт снова:"
    echo "  ./run-auto-setup.sh"
    exit 1
fi

echo "✅ Авторизованы в Yandex Cloud"
echo ""

# Запуск основного скрипта
./setup-yandex-cloud-complete.sh

