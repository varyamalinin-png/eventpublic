#!/bin/bash
# Скрипт для исправления прав доступа к VM после оплаты

echo "🔍 Проверка прав доступа к VM..."
echo ""

FOLDER_ID="b1ghu2t9vbuibrafe9ck"
VM_NAME="event-app-backend-v2"

# Проверяем статус VM
echo "📊 Статус VM:"
yc compute instance get $VM_NAME --format json 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); print('  Status:', d.get('status')); print('  ID:', d.get('id'))" 2>&1

echo ""
echo "🔐 Текущие права в папке:"
yc resource-manager folder list-access-bindings $FOLDER_ID 2>&1 | grep -E "(editor|admin|compute)" || echo "  Не найдено прав compute.*"

echo ""
echo "💡 Решение:"
echo "  1. Откройте веб-консоль: https://console.cloud.yandex.ru/folders/$FOLDER_ID/iam"
echo "  2. Убедитесь, что у вашего пользователя есть роль 'editor' или 'compute.admin'"
echo "  3. Если нет - добавьте роль через 'Добавить участника'"
echo ""
echo "  Или через CLI (нужен admin доступ):"
echo "  yc resource-manager folder add-access-binding $FOLDER_ID \\"
echo "    --role editor \\"
echo "    --subject userAccount:<YOUR_USER_ID>"
echo ""

