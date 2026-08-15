#!/bin/bash
# Настройка отправки писем через Yandex Cloud (Mail API по IAM-токену).
# Запускать на Ubuntu (в т.ч. на VM сервера), где установлен или будет установлен yc CLI.
# Использование:
#   ./server/scripts/setup-yandex-email-ubuntu.sh
#   FROM_EMAIL=noreply@iventapp.ru ./server/scripts/setup-yandex-email-ubuntu.sh

set -e
FROM_EMAIL="${YANDEX_CLOUD_FROM_EMAIL:-noreply@iventapp.ru}"

echo "📧 Настройка Yandex Cloud для отправки писем (токены верификации)"
echo "   Адрес отправителя: $FROM_EMAIL"
echo ""

# 1) Установка yc CLI, если нет
if ! command -v yc &>/dev/null; then
  echo "1️⃣  Установка Yandex Cloud CLI (yc)..."
  curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
  echo ""
  echo "   Выполните один раз: source ~/.bashrc   (или перезайдите в терминал)"
  echo "   Затем снова запустите этот скрипт."
  exit 0
fi

echo "1️⃣  yc CLI найден: $(yc version 2>/dev/null | head -1 || echo 'ok')"
echo ""

# 2) Проверка авторизации в yc
if ! yc config list &>/dev/null || [ -z "$(yc config list 2>/dev/null | grep token)" ]; then
  echo "2️⃣  Авторизация в Yandex Cloud"
  echo "   Выполните: yc init"
  echo "   (укажите OAuth-токен или сервисный аккаунт)"
  echo ""
  yc init 2>/dev/null || true
fi

# 3) Получение IAM-токена
echo "2️⃣  Получение IAM-токена..."
IAM_TOKEN=""
if IAM_TOKEN=$(yc iam create-token 2>/dev/null); then
  echo "   ✅ IAM-токен получен (действует ~12 ч)"
else
  echo "   ❌ Не удалось получить IAM-токен. Проверьте: yc init && yc iam create-token"
  exit 1
fi

echo ""
echo "3️⃣  Переменные окружения для отправки писем (Mail API):"
echo "────────────────────────────────────────────────────────────"
echo "export YANDEX_IAM_TOKEN=\"$IAM_TOKEN\""
echo "export YANDEX_CLOUD_FROM_EMAIL=\"$FROM_EMAIL\""
echo "────────────────────────────────────────────────────────────"
echo ""

# 4) Запись в .env в текущей директории или в директорию проекта
ENV_FILE=""
if [ -f .env ]; then
  ENV_FILE=".env"
elif [ -f server/.env ]; then
  ENV_FILE="server/.env"
fi

if [ -n "$ENV_FILE" ]; then
  if grep -q "YANDEX_IAM_TOKEN=" "$ENV_FILE" 2>/dev/null; then
    echo "   В $ENV_FILE уже есть YANDEX_IAM_TOKEN. Обновить вручную при необходимости."
  else
    echo "YANDEX_IAM_TOKEN=$IAM_TOKEN" >> "$ENV_FILE"
    echo "YANDEX_CLOUD_FROM_EMAIL=$FROM_EMAIL" >> "$ENV_FILE"
    echo "   ✅ Добавлено в $ENV_FILE"
  fi
else
  echo "   Создайте .env в корне проекта или в server/ и добавьте строки выше."
fi

echo ""
echo "⚠️  IAM-токен действует ~12 часов. Для продакшена:"
echo "   • настройте cron для обновления YANDEX_IAM_TOKEN (например, через yc iam create-token или get-yandex-iam-token.js),"
echo "   либо используйте статические ключи Postbox (YANDEX_CLOUD_ACCESS_KEY_ID, YANDEX_CLOUD_SECRET_ACCESS_KEY, YANDEX_CLOUD_FROM_EMAIL)."
echo ""
echo "После установки переменных перезапустите backend (например: pm2 restart event-app)."
