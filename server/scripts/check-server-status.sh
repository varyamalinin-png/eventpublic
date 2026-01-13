#!/bin/bash
# Скрипт для диагностики проблем с сервером iventapp.ru

echo "🔍 Диагностика сервера iventapp.ru..."
echo ""

# Переменные по умолчанию
YANDEX_VM_HOST="${YANDEX_VM_HOST:-89.169.173.152}"
YANDEX_VM_USER="${YANDEX_VM_USER:-ubuntu}"

echo "📍 Подключение к: $YANDEX_VM_USER@$YANDEX_VM_HOST"
echo ""

# Определяем путь к SSH ключу
SSH_KEY_OPTION=""
if [ -n "$YANDEX_VM_SSH_KEY" ]; then
  SSH_KEY_OPTION="-i $YANDEX_VM_SSH_KEY"
elif [ -f ~/.ssh/yandex-cloud ]; then
  SSH_KEY_OPTION="-i ~/.ssh/yandex-cloud"
fi

# Выполняем проверки на сервере
ssh $SSH_KEY_OPTION -o ConnectTimeout=10 -o StrictHostKeyChecking=no $YANDEX_VM_USER@$YANDEX_VM_HOST bash << 'ENDSSH'

echo "═══════════════════════════════════════════════════════════"
echo "1. Проверка nginx"
echo "═══════════════════════════════════════════════════════════"
if systemctl is-active --quiet nginx; then
  echo "✅ nginx запущен"
  systemctl status nginx --no-pager -l | head -10
else
  echo "❌ nginx НЕ запущен!"
  echo "Попробуйте: sudo systemctl start nginx"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "2. Проверка портов (80, 443, 3000, 4000)"
echo "═══════════════════════════════════════════════════════════"
echo "Проверка портов через netstat/ss:"
if command -v ss &> /dev/null; then
  ss -tlnp | grep -E ':(80|443|3000|4000)' || echo "❌ Порты не слушаются"
elif command -v netstat &> /dev/null; then
  netstat -tlnp | grep -E ':(80|443|3000|4000)' || echo "❌ Порты не слушаются"
else
  echo "⚠️  netstat/ss не найдены"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "3. Проверка PM2 процессов"
echo "═══════════════════════════════════════════════════════════"
if command -v pm2 &> /dev/null; then
  echo "📊 Статус PM2:"
  pm2 status
  echo ""
  echo "📋 Логи последних процессов:"
  pm2 list | tail -10
else
  echo "⚠️  PM2 не установлен"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "4. Проверка SSL сертификатов"
echo "═══════════════════════════════════════════════════════════"
if [ -d /etc/letsencrypt/live/iventapp.ru ]; then
  echo "✅ Директория сертификата существует"
  if [ -f /etc/letsencrypt/live/iventapp.ru/fullchain.pem ]; then
    echo "✅ fullchain.pem существует"
    openssl x509 -in /etc/letsencrypt/live/iventapp.ru/fullchain.pem -noout -dates 2>/dev/null || echo "⚠️  Не удалось прочитать сертификат"
  else
    echo "❌ fullchain.pem НЕ найден!"
  fi
  if [ -f /etc/letsencrypt/live/iventapp.ru/privkey.pem ]; then
    echo "✅ privkey.pem существует"
  else
    echo "❌ privkey.pem НЕ найден!"
  fi
else
  echo "❌ Директория сертификата НЕ найдена: /etc/letsencrypt/live/iventapp.ru"
  echo "   Нужно установить SSL сертификат через certbot"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "5. Проверка конфигурации nginx"
echo "═══════════════════════════════════════════════════════════"
if [ -f /etc/nginx/sites-available/iventapp.ru ]; then
  echo "✅ Файл конфигурации существует"
  echo "Проверка синтаксиса:"
  sudo nginx -t 2>&1
else
  echo "❌ Файл конфигурации НЕ найден: /etc/nginx/sites-available/iventapp.ru"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "6. Проверка доступности сервисов локально"
echo "═══════════════════════════════════════════════════════════"
echo "Next.js (порт 3000):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Недоступен"
echo "Backend (порт 4000):"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:4000/health || echo "❌ Недоступен"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "7. Последние ошибки nginx"
echo "═══════════════════════════════════════════════════════════"
if [ -f /var/log/nginx/iventapp.ru.error.log ]; then
  echo "Последние 20 строк error.log:"
  sudo tail -20 /var/log/nginx/iventapp.ru.error.log 2>/dev/null || echo "⚠️  Не удалось прочитать лог"
else
  echo "⚠️  Лог-файл не найден"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "8. Проверка доступности извне"
echo "═══════════════════════════════════════════════════════════"
echo "Проверка порта 443 изнутри сервера:"
timeout 3 bash -c 'echo > /dev/tcp/localhost/443' 2>/dev/null && echo "✅ Порт 443 слушается" || echo "❌ Порт 443 не доступен"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "9. Рекомендации"
echo "═══════════════════════════════════════════════════════════"
echo "Если сайт не работает, проверьте:"
echo "1. Yandex Cloud Security Groups - порты 80 и 443 должны быть открыты"
echo "2. nginx должен быть запущен: sudo systemctl start nginx"
echo "3. PM2 процессы должны быть запущены: pm2 status"
echo "4. SSL сертификат должен быть валидным"
echo "5. Конфигурация nginx должна быть корректной: sudo nginx -t"
echo ""

ENDSSH

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Диагностика завершена!"
  echo ""
  echo "💡 Следующие шаги:"
  echo "   1. Если nginx не запущен: ssh $YANDEX_VM_USER@$YANDEX_VM_HOST 'sudo systemctl start nginx'"
  echo "   2. Если процессы PM2 не запущены: используйте restart-server-on-vm.sh"
  echo "   3. Если порты закрыты: проверьте Security Groups в Yandex Cloud"
  echo "   4. Если SSL сертификат отсутствует: sudo certbot --nginx -d iventapp.ru"
else
  echo ""
  echo "❌ Ошибка при подключении к серверу"
  echo "   Проверьте SSH ключ и доступность сервера"
fi

