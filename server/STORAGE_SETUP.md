# Настройка Yandex Object Storage для загрузки фото

## Проблема
Фото загружаются, но не отображаются в приложении, потому что:
1. Нет bucket в Yandex Object Storage
2. Нет правильных публичных URL для доступа к файлам

## Решение

### 1. Создать bucket через веб-консоль:
1. Откройте https://console.yandex.cloud
2. Перейдите в раздел **Object Storage**
3. Нажмите **"Создать bucket"**
4. Укажите имя: `event-app-storage`
5. Выберите тип доступа: **Публичный** (для чтения)
6. Выберите регион: `ru-central1`
7. Создайте bucket

### 2. Настроить публичный доступ:
После создания bucket:
1. Откройте bucket `event-app-storage`
2. Перейдите в раздел **"Права доступа"** или **"Access"**
3. Включите **"Публичный доступ для чтения"** или **"Public read access"**

### 3. Проверить переменные окружения:
На сервере должны быть установлены:
```
STORAGE_ACCESS_KEY=[установить в .env]
STORAGE_SECRET_KEY=[установить в .env]
STORAGE_PUBLIC_BASE_URL=https://event-app-storage.storage.yandexcloud.net
```

### 4. После создания bucket:
- Фото будут загружаться в bucket
- Публичные URL будут иметь формат: `https://event-app-storage.storage.yandexcloud.net/events/{userId}/{filename}`
- Фото будут доступны для просмотра в приложении

## Альтернатива: Создать bucket через CLI

Если веб-консоль недоступна, можно попробовать:
```bash
yc storage bucket create \
  --name event-app-storage \
  --folder-id b1ghu2t9vbuibrafe9ck \
  --default-storage-class standard \
  --max-size 10737418240 \
  --public-read
```

Но сначала нужно убедиться, что Object Storage API включен для вашего облака.

