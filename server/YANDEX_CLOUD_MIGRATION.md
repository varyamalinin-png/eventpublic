# 🚀 Миграция с Railway на Yandex Cloud

## ✅ Преимущества миграции

1. ✅ **Решит проблему DNS** - `mail-api.cloud.yandex.net` будет доступен
2. ✅ **Все сервисы в одной экосистеме** - лучшая интеграция
3. ✅ **Yandex Cloud Email API** будет работать без проблем
4. ✅ **Возможно дешевле** - особенно для российских пользователей
5. ✅ **Лучшая производительность** - сервисы в одном регионе

## 📋 Текущая инфраструктура

### На Railway:
- **Backend**: NestJS приложение (Node.js)
- **Database**: PostgreSQL (Railway Managed)
- **Cache**: Redis (Railway Managed)
- **Storage**: S3-compatible (MinIO или AWS S3)
- **Email**: Yandex Cloud Email API (не работает из-за DNS)

## 🎯 План миграции на Yandex Cloud

### 1. Compute Cloud (VM для приложения)

**Вариант A: Yandex Compute Cloud (VM)**
- Создать виртуальную машину (Ubuntu 22.04)
- Установить Node.js 18+
- Развернуть приложение
- Настроить systemd для автозапуска

**Вариант B: Yandex Cloud Functions (Serverless)**
- Менее подходит для NestJS (нужны WebSockets)
- Но можно рассмотреть для API части

**Вариант C: Yandex Container Registry + Kubernetes**
- Более сложно, но масштабируемо

### 2. Managed PostgreSQL

- **Yandex Managed PostgreSQL**
- Создать кластер PostgreSQL
- Мигрировать данные из Railway
- Обновить DATABASE_URL

### 3. Managed Redis

- **Yandex Managed Redis** (если доступен)
- Или установить Redis на той же VM
- Обновить REDIS_URL

### 4. Object Storage

- **Yandex Object Storage (S3-compatible)**
- Создать bucket для медиа файлов
- Обновить STORAGE_* переменные

### 5. Email API

- **Yandex Cloud Email API** - уже настроен
- Будет работать без проблем DNS

## 📝 Пошаговая инструкция

### Шаг 1: Подготовка Yandex Cloud

1. Создать аккаунт в [Yandex Cloud](https://cloud.yandex.ru)
2. Создать каталог (folder)
3. Настроить платежный аккаунт

### Шаг 2: Создать Managed PostgreSQL

```bash
# Через Yandex Cloud CLI или Console
yc managed-postgresql cluster create \
  --name event-app-db \
  --network-name default \
  --host zone-id=ru-central1-a,subnet-id=<subnet-id> \
  --resource-preset s2.micro \
  --disk-size 10 \
  --user name=postgres,password=<password> \
  --database name=event_app
```

### Шаг 3: Создать Object Storage

```bash
# Создать bucket
yc storage bucket create \
  --name event-app-media \
  --max-size 10737418240
```

### Шаг 4: Создать VM для приложения

```bash
# Создать VM
yc compute instance create \
  --name event-app-backend \
  --zone ru-central1-a \
  --network-interface subnet-name=default-ru-central1-a,nat-ip-version=ipv4 \
  --create-boot-disk image-folder-id=standard-images,image-family=ubuntu-2204-lts,size=20 \
  --ssh-key ~/.ssh/id_rsa.pub \
  --cores 2 \
  --memory 4GB
```

### Шаг 5: Настроить VM

```bash
# Подключиться к VM
ssh ubuntu@<vm-ip>

# Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установить PM2 для управления процессом
sudo npm install -g pm2

# Клонировать репозиторий
git clone <your-repo>
cd event_app_new/server

# Установить зависимости
npm install --legacy-peer-deps

# Настроить переменные окружения
nano .env
```

### Шаг 6: Миграция данных

```bash
# Экспорт данных с Railway
pg_dump $RAILWAY_DATABASE_URL > backup.sql

# Импорт в Yandex Cloud PostgreSQL
psql $YANDEX_DATABASE_URL < backup.sql
```

### Шаг 7: Настроить автозапуск

```bash
# Создать PM2 ecosystem файл
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'event-app-backend',
    script: 'dist/src/main.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# Запустить через PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Шаг 8: Настроить Nginx (опционально)

```bash
sudo apt install nginx
# Настроить reverse proxy для приложения
```

### Шаг 9: Обновить переменные окружения

```env
# Database
DATABASE_URL=postgresql://postgres:password@<postgres-host>:6432/event_app

# Redis (если используете Managed Redis)
REDIS_URL=redis://<redis-host>:6379

# Storage
STORAGE_ENDPOINT=https://storage.yandexcloud.net
STORAGE_BUCKET=event-app-media
STORAGE_ACCESS_KEY=<access-key>
STORAGE_SECRET_KEY=<secret-key>
STORAGE_REGION=ru-central1

# Email (уже настроено)
YANDEX_IAM_TOKEN=<token>
YANDEX_CLOUD_FROM_EMAIL=noreply@iventapp.ru
YANDEX_CLOUD_API_ENDPOINT=https://mail-api.cloud.yandex.net
```

## 🔄 Альтернативный вариант: Yandex Cloud Run

Если не нужны WebSockets, можно использовать **Yandex Cloud Run** (serverless):

1. Создать Dockerfile
2. Запушить в Yandex Container Registry
3. Развернуть через Cloud Run

## 💰 Оценка стоимости

### Yandex Cloud (примерно):
- **VM** (s2.micro, 2 vCPU, 4GB RAM): ~1500₽/мес
- **Managed PostgreSQL** (s2.micro): ~2000₽/мес
- **Object Storage**: ~100₽/мес (за 10GB)
- **Итого**: ~3600₽/мес

### Railway (для сравнения):
- Зависит от плана, обычно $5-20/мес

## ⚠️ Важные моменты

1. **Бэкапы**: Настроить автоматические бэкапы PostgreSQL
2. **Мониторинг**: Настроить Yandex Monitoring
3. **Логи**: Настроить Yandex Logging
4. **Безопасность**: Настроить Security Groups
5. **SSL**: Настроить сертификат для домена

## 🚀 Быстрый старт

1. Создать ресурсы в Yandex Cloud Console
2. Настроить VM и установить приложение
3. Мигрировать данные
4. Обновить DNS записи
5. Протестировать

## 📚 Полезные ссылки

- [Yandex Cloud Documentation](https://cloud.yandex.ru/docs)
- [Yandex Compute Cloud](https://cloud.yandex.ru/docs/compute/)
- [Yandex Managed PostgreSQL](https://cloud.yandex.ru/docs/managed-postgresql/)
- [Yandex Object Storage](https://cloud.yandex.ru/docs/storage/)

## ✅ После миграции

1. ✅ DNS проблема решена
2. ✅ Email API работает
3. ✅ Все сервисы в одной экосистеме
4. ✅ Лучшая производительность
5. ✅ Проще управление

