# 🚀 Быстрый старт: Миграция на Yandex Cloud

## ✅ Преимущества

1. ✅ **Решит проблему DNS** - `mail-api.cloud.yandex.net` будет доступен
2. ✅ **Все сервисы в одной экосистеме** - лучшая интеграция
3. ✅ **Yandex Cloud Email API** работает без проблем
4. ✅ **Возможно дешевле** для российских пользователей
5. ✅ **Лучшая производительность** - все в одном регионе

## 📋 Что нужно создать в Yandex Cloud

### 1. Compute Cloud (VM) - для приложения
- **Конфигурация**: 2 vCPU, 4GB RAM (s2.micro)
- **Диск**: 20GB SSD
- **OS**: Ubuntu 22.04 LTS
- **Стоимость**: ~1500₽/мес

### 2. Managed PostgreSQL - для базы данных
- **Конфигурация**: s2.micro (2 vCPU, 4GB RAM)
- **Диск**: 10GB SSD
- **Стоимость**: ~2000₽/мес

### 3. Object Storage - для медиа файлов
- **Bucket**: event-app-media
- **Стоимость**: ~100₽/мес (за 10GB)

### 4. Redis (опционально)
- Можно установить на той же VM
- Или использовать Managed Redis (если доступен)

## 🚀 Пошаговая инструкция

### Шаг 1: Создать VM в Yandex Cloud

1. Зайдите в [Yandex Cloud Console](https://console.cloud.yandex.ru)
2. Compute Cloud → Virtual machines → Create
3. Настройки:
   - **Name**: event-app-backend
   - **Zone**: ru-central1-a
   - **Platform**: Intel Ice Lake
   - **vCPU**: 2
   - **RAM**: 4GB
   - **Disk**: 20GB SSD
   - **Image**: Ubuntu 22.04 LTS
   - **Network**: default
   - **Public IP**: включить
   - **SSH key**: добавить ваш публичный ключ

### Шаг 2: Создать Managed PostgreSQL

1. Database → Managed PostgreSQL → Create cluster
2. Настройки:
   - **Name**: event-app-db
   - **Zone**: ru-central1-a
   - **Version**: PostgreSQL 15
   - **Configuration**: s2.micro
   - **Disk**: 10GB
   - **User**: postgres
   - **Password**: создать безопасный пароль
   - **Database**: event_app

### Шаг 3: Создать Object Storage

1. Object Storage → Create bucket
2. Настройки:
   - **Name**: event-app-media
   - **Access**: Private (или Public для статики)
   - **Max size**: 10GB

### Шаг 4: Настроить VM

```bash
# Подключиться к VM
ssh ubuntu@<vm-public-ip>

# Запустить скрипт настройки
curl -fsSL https://raw.githubusercontent.com/your-repo/event_app_new/main/server/yandex-cloud-setup.sh | bash

# Или вручную:
cd /opt/event-app/server
chmod +x yandex-cloud-setup.sh
./yandex-cloud-setup.sh
```

### Шаг 5: Настроить переменные окружения

```bash
# На VM
cd /opt/event-app/server
cp yandex-cloud-env-template.env .env
nano .env  # Заполните все значения
```

### Шаг 6: Мигрировать данные

```bash
# На вашем локальном компьютере
# Экспорт данных с Railway
pg_dump $RAILWAY_DATABASE_URL > backup.sql

# Импорт в Yandex Cloud PostgreSQL
psql $YANDEX_DATABASE_URL < backup.sql
```

### Шаг 7: Запустить приложение

```bash
# На VM
cd /opt/event-app/server

# Запустить миграции
npm run prisma:deploy

# Запустить через PM2
pm2 start ecosystem.config.js
pm2 save

# Проверить статус
pm2 status
pm2 logs
```

### Шаг 8: Настроить Nginx (для домена)

```bash
# Установить Nginx
sudo apt install nginx

# Создать конфигурацию
sudo nano /etc/nginx/sites-available/event-app

# Добавить:
server {
    listen 80;
    server_name your-domain.ru;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Включить конфигурацию
sudo ln -s /etc/nginx/sites-available/event-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Шаг 9: Настроить SSL (Let's Encrypt)

```bash
# Установить Certbot
sudo apt install certbot python3-certbot-nginx

# Получить сертификат
sudo certbot --nginx -d your-domain.ru
```

## 🔧 Настройка Object Storage

1. Создать сервисный аккаунт в Yandex Cloud
2. Выдать права на bucket
3. Создать статический ключ доступа
4. Добавить в `.env`:
   ```
   STORAGE_ACCESS_KEY=your-access-key
   STORAGE_SECRET_KEY=your-secret-key
   ```

## 📊 Мониторинг

- **Yandex Monitoring**: автоматически собирает метрики
- **PM2 Monitoring**: `pm2 monit`
- **Логи**: `pm2 logs`

## 🔄 Обновление приложения

```bash
# На VM
cd /opt/event-app/server
git pull
npm install --legacy-peer-deps
npm run prisma:generate
npm run build
pm2 restart event-app-backend
```

## 💰 Оценка стоимости

- **VM** (s2.micro): ~1500₽/мес
- **Managed PostgreSQL**: ~2000₽/мес
- **Object Storage**: ~100₽/мес
- **Итого**: ~3600₽/мес (~$40/мес)

## ✅ После миграции

1. ✅ DNS проблема решена
2. ✅ Email API работает
3. ✅ Все сервисы в одной экосистеме
4. ✅ Лучшая производительность
5. ✅ Проще управление

## 🆘 Поддержка

Если возникнут проблемы:
- [Yandex Cloud Documentation](https://cloud.yandex.ru/docs)
- [Yandex Cloud Support](https://cloud.yandex.ru/support)

