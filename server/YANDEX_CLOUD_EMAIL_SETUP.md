# Инструкция по настройке Yandex Cloud Email API

## ✅ Преимущества

- **HTTP API** - работает на Railway (не требует SMTP портов)
- Надежная доставка через Yandex Cloud
- Высокий приоритет в системе отправки

---

## Шаг 1: Создать сервисный аккаунт в Yandex Cloud

1. Перейдите в [Yandex Cloud Console](https://console.cloud.yandex.ru/)
2. Выберите каталог (folder)
3. Перейдите в **IAM → Сервисные аккаунты**
4. Нажмите **Создать сервисный аккаунт**
5. Укажите имя (например, `email-sender`)
6. Назначьте роль: `mail.editor` (для отправки email)
7. Нажмите **Создать**

---

## Шаг 2: Создать IAM токен для сервисного аккаунта

### Вариант A: Использовать IAM токен (для тестирования)

1. В [Yandex Cloud Console](https://console.cloud.yandex.ru/) перейдите к сервисному аккаунту
2. Перейдите на вкладку **Ключи**
3. Нажмите **Создать новый ключ → IAM токен**
4. Скопируйте токен (показывается только один раз!)

### Вариант B: Использовать авторизованный ключ (для продакшена)

1. Создайте авторизованный ключ для сервисного аккаунта
2. Используйте этот ключ для получения IAM токена через API

**Примечание:** Для продакшена лучше использовать авторизованный ключ и автоматически обновлять IAM токен.

---

## Шаг 3: Верифицировать email адрес отправителя

1. Перейдите в [Yandex Cloud Postbox](https://console.cloud.yandex.ru/folders/<folder-id>/postbox)
2. Создайте новый адрес или используйте существующий
3. Верифицируйте email адрес (проверьте почту и подтвердите)

**Важно:** Email адрес должен быть верифицирован в Yandex Cloud Postbox!

---

## Шаг 4: Добавить переменные в Railway

Добавьте в Railway Dashboard → Variables:

```
YANDEX_IAM_TOKEN=ваш_iam_токен_из_шага_2
YANDEX_CLOUD_FROM_EMAIL=ваш_верифицированный_email@yandex.ru
YANDEX_CLOUD_API_ENDPOINT=https://mail-api.cloud.yandex.net
```

**Примечание:** `YANDEX_CLOUD_API_ENDPOINT` необязателен, по умолчанию используется `https://mail-api.cloud.yandex.net`

---

## Шаг 5: Готово!

Railway автоматически перезапустится с новыми настройками.

Yandex Cloud Email API будет использоваться **первым** в приоритете отправки.

---

## Проверка работы

После деплоя проверьте логи Railway - там должно быть:

```
✅ Yandex Cloud Email API enabled (from: ваш_email@yandex.ru)
```

При отправке письма:
```
✅ Using Yandex Cloud Email API to send email to ...
✅ Yandex Cloud email sent. Message ID: ...
```

---

## Приоритет отправки email

1. **Yandex Cloud Email API** ✅ (высший приоритет)
2. Mailgun API
3. SendGrid API
4. Resend API
5. SMTP (не работает на Railway)

---

## Получение IAM токена (для продакшена)

Если хотите автоматически обновлять IAM токен, можно использовать авторизованный ключ:

```javascript
// Пример получения IAM токена через авторизованный ключ
const yc = require('@yandex-cloud/nodejs-sdk');
const { IamTokenService } = require('@yandex-cloud/nodejs-sdk/build/src/iam/iam-token-service');

const tokenService = new IamTokenService({
  serviceAccountKey: {
    serviceAccountId: 'your-service-account-id',
    privateKey: 'your-private-key',
  },
});

const iamToken = await tokenService.getToken();
```

Но для начала достаточно использовать статический IAM токен из консоли.

---

## Устранение проблем

### Ошибка: "sender is not allowed"
- Убедитесь, что email адрес верифицирован в Yandex Cloud Postbox
- Проверьте, что сервисный аккаунт имеет права `mail.editor`

### Ошибка: "MailFromDomainNotVerifiedException"
- Email адрес должен быть верифицирован в Yandex Cloud Postbox
- Перейдите в Postbox и верифицируйте адрес

### Ошибка: "Authentication failed"
- Проверьте правильность IAM токена
- Убедитесь, что сервисный аккаунт активен

---

## Документация

- [Yandex Cloud Email API](https://cloud.yandex.ru/docs/mail/api-ref/Email/sendEmail)
- [Yandex Cloud Postbox](https://cloud.yandex.ru/docs/postbox/)

