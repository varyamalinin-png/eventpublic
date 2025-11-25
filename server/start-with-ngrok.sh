#!/bin/bash

# Скрипт для запуска сервера с ngrok туннелем
# Убедитесь, что у вас установлен ngrok: brew install ngrok или скачайте с ngrok.com

echo "🚀 Запуск сервера с ngrok туннелем..."

# Проверяем, установлен ли ngrok
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok не установлен!"
    echo "Установите ngrok:"
    echo "  brew install ngrok"
    echo "  или скачайте с https://ngrok.com/download"
    exit 1
fi

# Убиваем старые процессы ngrok
pkill -f ngrok || true

# Запускаем сервер в фоне
echo "📦 Запуск NestJS сервера на порту 4000..."
cd server
npm run start:dev &
SERVER_PID=$!
cd ..

# Ждем немного, чтобы сервер запустился
sleep 3

# Запускаем ngrok туннель
echo "🌐 Запуск ngrok туннеля..."
ngrok http 4000 > /dev/null &
NGROK_PID=$!

# Ждем запуска ngrok
sleep 5

# Получаем URL туннеля
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Не удалось получить ngrok URL. Проверьте, что ngrok запущен."
    kill $SERVER_PID $NGROK_PID 2>/dev/null
    exit 1
fi

echo ""
echo "✅ Сервер запущен!"
echo "📱 Используйте этот URL в .env файле клиента:"
echo "   EXPO_PUBLIC_API_URL=$NGROK_URL"
echo ""
echo "Нажмите Ctrl+C для остановки..."

# Функция для очистки при завершении
cleanup() {
    echo ""
    echo "🛑 Остановка сервера и ngrok..."
    kill $SERVER_PID $NGROK_PID 2>/dev/null
    pkill -f ngrok
    exit
}

trap cleanup SIGINT SIGTERM

# Ждем
wait

