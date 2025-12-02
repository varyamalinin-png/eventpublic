# Настройка Yandex Cloud Email API

Это руководство поможет настроить отправку email через Yandex Cloud Email API.

## Необходимые переменные окружения

### Обязательные:

1. **YANDEX_IAM_TOKEN** - IAM токен для авторизации в Yandex Cloud API
   - Действителен 12 часов
   - Получается автоматически через скрипт

2. **YANDEX_CLOUD_FROM_EMAIL** - Адрес отправителя
   - Пример: `noreply@iventapp.ru`
   - Домен должен быть подтвержден в Yandex Cloud

### Опциональные:

3. **YANDEX_CLOUD_API_ENDPOINT** - URL API (по умолчанию: `https://mail-api.cloud.yandex.net`)

4. **EMAIL_VERIFICATION_REDIRECT_URL** - URL для редиректа после подтверждения email

5. **PASSWORD_RESET_REDIRECT_URL** - URL для редиректа после сброса пароля

## Быстрая настройка

### 1. Получить IAM токен

```bash
cd server
node scripts/get-yandex-iam-token.js
```

Скопируйте полученный токен.

### 2. Проверить конфигурацию

```bash
cd server
node scripts/check-yandex-email-config.js
```

Скрипт проверит все переменные и валидность токена.

### 3. Установить переменные в Railway

#### Через Railway CLI:

```bash
# Установить IAM токен (скопируйте из вывода get-yandex-iam-token.js)
railway variables set YANDEX_IAM_TOKEN="ваш_токен" --service eventpublic

# Установить адрес отправителя
railway variables set YANDEX_CLOUD_FROM_EMAIL="noreply@iventapp.ru" --service eventpublic

# Опционально: установить URL редиректов
railway variables set EMAIL_VERIFICATION_REDIRECT_URL="https://ваш-домен.com/auth/verify" --service eventpublic
railway variables set PASSWORD_RESET_REDIRECT_URL="https://ваш-домен.com/auth/reset" --service eventpublic
```

#### Через Railway Dashboard:

1. Перейдите на https://railway.app
2. Выберите проект и сервис `eventpublic`
3. Перейдите в раздел **Variables**
4. Добавьте следующие переменные:
   - `YANDEX_IAM_TOKEN` = (токен из скрипта)
   - `YANDEX_CLOUD_FROM_EMAIL` = `noreply@iventapp.ru`
   - `EMAIL_VERIFICATION_REDIRECT_URL` = (URL вашего фронтенда)
   - `PASSWORD_RESET_REDIRECT_URL` = (URL вашего фронтенда)

## Важные замечания

### IAM токен действителен 12 часов

IAM токен нужно обновлять каждые 12 часов. Для продакшена рекомендуется:

1. **Автоматическое обновление токена** - настроить cron job или scheduled task
2. **Использовать авторизованный ключ** - более безопасный вариант для долгосрочного использования

### Подтверждение домена

Убедитесь, что домен `iventapp.ru` подтвержден в Yandex Cloud:

1. Перейдите в Yandex Cloud Console
2. Откройте раздел **Email**
3. Добавьте и подтвердите домен `iventapp.ru`
4. Настройте DNS записи согласно инструкциям

### Права сервисного аккаунта

Сервисный аккаунт должен иметь следующие роли:
- `editor` или `admin` на каталоге с ресурсом Email API
- Права на отправку email через Email API

## Проверка работы

После настройки переменных:

1. Перезапустите сервис в Railway
2. Проверьте логи - должна появиться запись:
   ```
   ✅ Yandex Cloud Email API enabled (from: noreply@iventapp.ru)
   ```
3. Попробуйте зарегистрировать нового пользователя
4. Проверьте, что письмо отправляется

## Устранение проблем

### Ошибка: "Yandex Cloud Email API is not configured"

- Проверьте, что все переменные окружения установлены
- Проверьте, что переменные установлены в правильном сервисе Railway
- Перезапустите сервис после установки переменных

### Ошибка: "IAM токен невалиден"

- Получите новый токен: `node scripts/get-yandex-iam-token.js`
- Установите новый токен в Railway
- Убедитесь, что токен скопирован полностью (без переносов строк)

### Ошибка: "Network error: Unable to connect to Yandex Cloud API"

- Проверьте подключение к интернету
- Проверьте, что API endpoint правильный
- Проверьте файрвол и настройки сети

### Письма не доходят

- Проверьте, что домен подтвержден в Yandex Cloud
- Проверьте папку "Спам" у получателя
- Проверьте логи сервера на наличие ошибок
- Убедитесь, что адрес отправителя правильный

## Дополнительные ресурсы

- [Документация Yandex Cloud Email API](https://cloud.yandex.ru/docs/mail/)
- [Документация Railway Variables](https://docs.railway.app/develop/variables)

