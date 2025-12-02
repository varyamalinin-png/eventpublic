# Исправление проблемы с загрузкой фото

## Проблема
Фото не отображаются в приложении после создания события.

## Решение

### 1. Создан bucket в Yandex Object Storage
- Имя: `event-app-storage`
- Публичный доступ для чтения: включен
- Регион: `ru-central1`

### 2. Настроены credentials
- `STORAGE_ACCESS_KEY`: [установить в .env]
- `STORAGE_SECRET_KEY`: [установить в .env]
- `STORAGE_PUBLIC_BASE_URL`: https://event-app-storage.storage.yandexcloud.net

### 3. Назначена роль storage.editor
- Сервисному аккаунту `email-api-sender` назначена роль `storage.editor` на каталог и облако
- Это дает права на запись в Object Storage

### 4. Обновлен buildPublicUrl
- Теперь правильно генерирует URL для Yandex Cloud: `https://event-app-storage.storage.yandexcloud.net/{key}`

## Проверка

Попробуйте создать новое событие с фото из галереи. Фото должно:
1. Загрузиться в bucket при создании события
2. Получить правильный публичный URL
3. Отображаться в ленте и других частях приложения

Если фото все еще не отображается, проверьте логи:
```bash
ssh ubuntu@89.169.173.152 "pm2 logs event-app --lines 100 | grep -i storage"
```

