# ⚡ Быстрые команды для настройки

## 🔄 Если соединение прервалось

Просто переподключитесь через веб-консоль и выполните команды ниже.

## 📋 Команды для выполнения (по порядку)

### 1. Проверка текущего состояния

```bash
cd ~/event_app_new/server
pwd
ls -la
```

### 2. Запуск PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

### 3. Применение миграций базы данных

```bash
cd ~/event_app_new/server
npx prisma db push --accept-data-loss
```

### 4. Запуск приложения через PM2

```bash
cd ~/event_app_new/server

# Удалить старый процесс (если есть)
pm2 delete event-app 2>/dev/null || true

# Запустить приложение
pm2 start dist/main.js --name event-app

# Сохранить конфигурацию
pm2 save
```

### 5. Настройка автозапуска

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

**Важно:** Скопируйте команду, которую выдаст PM2, и выполните её с `sudo`.

### 6. Проверка статуса

```bash
# Статус PM2
pm2 status

# Логи приложения
pm2 logs event-app --lines 20

# Проверка health endpoint
curl http://localhost:4000/health
```

## 🚀 Все в одной команде (если соединение стабильное)

```bash
cd ~/event_app_new/server && \
sudo systemctl start postgresql && \
sudo systemctl enable postgresql && \
sleep 2 && \
npx prisma db push --accept-data-loss && \
pm2 delete event-app 2>/dev/null || true && \
pm2 start dist/main.js --name event-app && \
pm2 save && \
sleep 3 && \
pm2 status && \
curl http://localhost:4000/health
```

## ⚠️ Если что-то пошло не так

### Проверка PostgreSQL
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### Проверка .env файла
```bash
cd ~/event_app_new/server
cat .env | grep -v SECRET | grep -v PASSWORD
```

### Проверка логов приложения
```bash
pm2 logs event-app --lines 50
```

### Перезапуск приложения
```bash
pm2 restart event-app
```

## ✅ После успешного запуска

Приложение будет доступно по адресу:
- **API**: http://51.250.105.190:4000
- **Health**: http://51.250.105.190:4000/health

Используйте этот адрес в мобильном приложении!

