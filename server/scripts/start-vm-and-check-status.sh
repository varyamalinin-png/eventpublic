#!/bin/bash
# Скрипт для запуска VM и проверки статуса сайта

echo "🔍 Проверка статуса VM..."
echo ""

# Переменные
VM_NAME="event-app-backend-v2"
FOLDER_ID="b1ghu2t9vbuibrafe9ck"

# Проверяем статус VM
STATUS=$(yc compute instance get $VM_NAME --format json 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ -z "$STATUS" ]; then
  echo "❌ Не удалось получить статус VM"
  exit 1
fi

echo "📊 Текущий статус VM: $STATUS"
echo ""

if [ "$STATUS" = "STOPPED" ]; then
  echo "⚠️  VM остановлена! Нужно запустить через веб-консоль:"
  echo "   https://console.cloud.yandex.ru/folders/$FOLDER_ID/compute/instances"
  echo ""
  echo "   Или через YC CLI (если есть права):"
  echo "   yc compute instance start $VM_NAME"
  echo ""
  exit 1
elif [ "$STATUS" = "RUNNING" ]; then
  echo "✅ VM запущена"
  
  # Получаем IP адрес
  IP=$(yc compute instance get $VM_NAME --format json 2>/dev/null | grep -A 5 'one_to_one_nat' | grep -o '"address":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$IP" ]; then
    echo "📍 Внешний IP: $IP"
    echo ""
    echo "🔍 Проверка доступности сайта..."
    sleep 5  # Даем время VM полностью загрузиться
    
    if curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://iventapp.ru/ | grep -q "200\|301\|302"; then
      echo "✅ Сайт доступен!"
    else
      echo "⚠️  Сайт еще не отвечает, но VM запущена"
      echo "   Возможно нужно подождать еще немного или проверить сервисы на сервере"
    fi
  fi
else
  echo "⚠️  Неизвестный статус: $STATUS"
fi

