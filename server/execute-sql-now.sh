#!/bin/bash
# Скрипт для выполнения SQL на Yandex Cloud VM через SSH

echo "Выполняю SQL для верификации пользователя на Yandex Cloud VM..."

if [ -z "$YANDEX_VM_HOST" ] || [ -z "$YANDEX_VM_USER" ]; then
  echo "❌ Не установлены переменные окружения для SSH подключения!"
  echo "Установите:"
  echo "  export YANDEX_VM_HOST=your-vm-ip-or-hostname"
  echo "  export YANDEX_VM_USER=your-username"
  exit 1
fi

# Выполняем SQL через SSH и psql
ssh $YANDEX_VM_USER@$YANDEX_VM_HOST "cd /path/to/server && psql \$DATABASE_URL -c \"UPDATE \\\"User\\\" SET \\\"emailVerified\\\" = true WHERE email = 'varya.malinina.2003@mail.ru' OR id = 'bb2948d1-32b9-4a6f-a033-fc2a92dcbc69';\""
