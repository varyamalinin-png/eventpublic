# Настройка отправки писем (верификация email)

При **обычной регистрации** (не через Google) пользователю на почту должно уходить письмо с ссылкой/токеном для подтверждения email. Если письмо не приходит — скорее всего не настроена отправка через Yandex Cloud.

Поддерживаются **два способа** отправки:

1. **Postbox** (статический ключ) — подходит для продакшена, ключи не истекают. **На VM в Yandex Cloud это единственный рабочий вариант** (см. ниже).
2. **Mail API по IAM-токену** — подходит для быстрой настройки с Ubuntu и `yc` CLI; токен живёт ~12 часов. **На VM в Yandex Cloud не работает**: хост `mail-api.cloud.yandex.net` не резолвится в DNS (ENOTFOUND), а Postbox принимает только статические ключи, не Bearer IAM.

---

## ⚠️ Ошибка «getaddrinfo ENOTFOUND mail-api.cloud.yandex.net» на VM

Если на продакшен-VM (например iventapp.ru) при отправке письма появляется:

`Failed to send verification email. getaddrinfo ENOTFOUND mail-api.cloud.yandex.net`

**Причина:** хост `mail-api.cloud.yandex.net` не резолвится в DNS на этой VM (в т.ч. в Yandex Cloud). Отправка по IAM-токену на такой машине работать не будет. Postbox (`postbox.cloud.yandex.net`) резолвится, но принимает только **статические ключи** (AWS SES), не IAM Bearer.

**Решение:** использовать **только Вариант 1 (Postbox со статическими ключами)**. Создайте статический ключ доступа в Yandex Cloud (Postbox / сервисный аккаунт), добавьте в `.env` на VM переменные `YANDEX_CLOUD_ACCESS_KEY_ID`, `YANDEX_CLOUD_SECRET_ACCESS_KEY`, `YANDEX_CLOUD_FROM_EMAIL`, перезапустите backend. После этого удалите или не используйте `YANDEX_IAM_TOKEN` для отправки писем.

---

## Вариант 1: Postbox (статический ключ)

Переменные окружения:

| Переменная | Описание |
|------------|----------|
| `YANDEX_CLOUD_ACCESS_KEY_ID` | Access Key ID (статический ключ доступа) |
| `YANDEX_CLOUD_SECRET_ACCESS_KEY` | Secret Access Key |
| `YANDEX_CLOUD_FROM_EMAIL` | Адрес отправителя (например `noreply@iventapp.ru`) |

Опционально: `YANDEX_CLOUD_API_ENDPOINT` (по умолчанию `https://postbox.cloud.yandex.net`).

**Как получить статический ключ:** Yandex Cloud Console → IAM → Сервисные аккаунты → выберите аккаунт с доступом к Postbox → «Создать ключ» (статический ключ доступа). Либо раздел Postbox в консоли, если там предусмотрено создание ключей для API. Сохраните Access Key ID и Secret — они задаются в `YANDEX_CLOUD_ACCESS_KEY_ID` и `YANDEX_CLOUD_SECRET_ACCESS_KEY`.

---

## Вариант 2: Mail API по IAM-токену (Ubuntu + yc CLI)

Переменные окружения:

| Переменная | Описание |
|------------|----------|
| `YANDEX_IAM_TOKEN` | IAM-токен (например из `yc iam create-token`) |
| `YANDEX_CLOUD_FROM_EMAIL` | Адрес отправителя (например `noreply@iventapp.ru`) |

**Быстрая настройка на Ubuntu (в т.ч. на VM):**

```bash
# На сервере Ubuntu (или локально с установленным yc)
cd /path/to/event_app_new
./server/scripts/setup-yandex-email-ubuntu.sh
```

Скрипт при необходимости установит `yc` CLI, предложит выполнить `yc init`, получит IAM-токен и выведет переменные (или добавит их в `.env`). После этого перезапустите backend (например `pm2 restart event-app`).

⚠️ IAM-токен действует ~12 часов. Для постоянной работы настройте cron, который обновляет `YANDEX_IAM_TOKEN` (например, раз в 6 часов запускает `yc iam create-token` и перезаписывает переменную в окружении backend), либо перейдите на вариант 1 (Postbox).

---

## Общее

Опционально для обоих вариантов:

- `EMAIL_VERIFICATION_REDIRECT_URL` — URL фронта для ссылки «Подтвердить email»

## Где задать переменные

- **Локально:** файл `.env` в корне `server/` (или в корне проекта, в зависимости от того, откуда запускается приложение).
- **На продакшене (VM):** в том же месте, откуда запускается backend (PM2, systemd, docker), или в скрипте деплоя.

После добавления/изменения переменных **перезапустите backend**.

## Как убедиться, что отправка включена

1. В логах при **старте** сервера:
   - Postbox: `✅ Yandex Cloud Email (Postbox) enabled, from: ...`;
   - Mail API (IAM): `✅ Yandex Cloud Email (Mail API + IAM) enabled, from: ...`;
   - если ничего не настроено: `❌ Yandex Cloud Email is not configured. Set either: (1) ... or (2) ...`.

2. При **регистрации** в логах:
   - при успешной отправке: `✅ Verification email sent to ...`;
   - при ошибке: `[AuthService] Failed to send verification email ...`.

3. В ответе API `POST /auth/register` есть поле `verificationEmailSent: true/false`. Если `false` — письмо не было отправлено.

4. Эндпоинт `GET /auth/email-status` возвращает `enabled`, `method` (Postbox / Mail API (IAM) / none), `fromEmail`.

## Важно

- **Postbox**: ключи создаются в Yandex Cloud для сервиса Postbox; укажите тот же `YANDEX_CLOUD_FROM_EMAIL`, с которого разрешена отправка.
- **Mail API (IAM)**: сервисный аккаунт или пользователь в yc должны иметь права на отправку почты через Mail API; домен/адрес отправителя должен быть настроен в Yandex Cloud.

После настройки переменных и перезапуска backend повторная регистрация (или «Отправить код повторно») должна присылать письма.
