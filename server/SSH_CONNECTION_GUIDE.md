# 🔐 Подключение к VM по SSH - Полная инструкция

## ✅ Что уже сделано

1. ✅ SSH ключ создан (`~/.ssh/yandex-cloud`)
2. ✅ SSH ключ добавлен в метаданные VM
3. ✅ VM работает (IP: 51.250.105.190)

## 🔌 Способы подключения

### Способ 1: Через SSH клиент (с вашего компьютера) - РЕКОМЕНДУЕТСЯ

Откройте терминал на вашем Mac и выполните:

```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@51.250.105.190
```

**Если появится предупреждение о неизвестном хосте**, введите `yes` и нажмите Enter.

### Способ 2: Через веб-консоль Yandex Cloud

1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru)
2. Compute Cloud → Виртуальные машины → `event-app-backend`
3. Нажмите **"Подключиться к ВМ по SSH"** или **"Подключиться"** → **"SSH"**
4. Вставьте **приватный ключ** (не публичный!):
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   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
   -----END OPENSSH PRIVATE KEY-----
   ```
5. Логин: `ubuntu`
6. Нажмите "Подключиться"

## 📋 После подключения

Как только подключитесь, выполните эти команды для запуска приложения:

```bash
# 1. Перейти в директорию проекта
cd ~/event_app_new/server

# 2. Запустить PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 3. Применить миграции базы данных
npx prisma db push --accept-data-loss

# 4. Запустить приложение
pm2 delete event-app 2>/dev/null || true
pm2 start dist/main.js --name event-app
pm2 save

# 5. Проверить статус
pm2 status

# 6. Проверить API
curl http://localhost:4000/health
```

## ⚠️ Важные моменты

1. **Используйте ПРИВАТНЫЙ ключ** для веб-консоли (не публичный!)
2. **Логин**: `ubuntu` (не `root` и не `yc-user`)
3. **IP адрес**: `51.250.105.190`
4. При первом подключении может появиться предупреждение - введите `yes`

## 🔧 Если не получается подключиться

1. Проверьте, что VM в статусе `RUNNING`
2. Проверьте, что порт 22 открыт в Security Groups
3. Попробуйте перезапустить VM
4. Убедитесь, что используете правильный приватный ключ

## ✅ После успешного запуска

Приложение будет доступно по адресу:
- **API**: http://51.250.105.190:4000
- **Health**: http://51.250.105.190:4000/health

Используйте этот адрес в мобильном приложении!

