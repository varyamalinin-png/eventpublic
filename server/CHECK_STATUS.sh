#!/bin/bash
# Скрипт для проверки статуса VM

export PATH="/opt/homebrew/bin:$PATH"

echo "🔍 Проверка статуса VM..."
echo ""

VM_STATUS=$(yc compute instance get event-app-backend --format json 2>/dev/null | jq -r '.status' || echo "NOT_FOUND")

if [ "$VM_STATUS" = "NOT_FOUND" ]; then
    echo "❌ VM еще не создана или не найдена"
    echo "Проверяю список всех VM..."
    yc compute instance list
elif [ "$VM_STATUS" = "RUNNING" ]; then
    VM_IP=$(yc compute instance get event-app-backend --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
    echo "✅ VM запущена!"
    echo "🌐 Публичный IP: $VM_IP"
    echo ""
    echo "🔗 Подключение:"
    echo "   ssh ubuntu@$VM_IP"
else
    echo "⏳ Статус VM: $VM_STATUS"
    echo "Ожидание запуска..."
fi

