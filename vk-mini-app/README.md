# VK Mini App (оболочка для iWent)

Отдельный фронтенд под [мини-приложения ВК](https://dev.vk.ru/mini-apps/overview): VK Bridge + VKUI + Vite. Основной продукт остаётся на `web/`; здесь — вход с ВК, разрешение сообщений от сообщества и вызов бэкенда для проверки подписи параметров запуска.

## Что сделано

- `VKWebAppInit`, `VKWebAppGetLaunchParams`, `VKWebAppGetUserInfo`
- Кнопка **«Разрешить сообщения от сообщества»** → `VKWebAppAllowMessagesFromGroup` (нужен `VITE_VK_GROUP_ID`)
- `POST {API}/vk/mini-app/session` с параметрами запуска — на сервере проверяется `sign` (HMAC-SHA256, base64url), опционально отправляется первое сообщение от сообщества

## Чат «внутри ВК»

Полноценный ваш чат из Nest/Web **внутри интерфейса мини-приложения** остаётся WebView/iframe. Сценарий «диалог в мессенджере ВК» делается так:

1. Пользователь нажимает «Разрешить сообщения от сообщества».
2. В настройках ВК у сообщества включены **Сообщения**, выдан токен с правом `messages`.
3. На сервере заданы `VK_GROUP_MESSAGES_TOKEN` и `VK_GROUP_WELCOME_TEXT` — после успешной проверки `sign` бэкенд вызывает `messages.send` и пользователь видит чат с сообществом в обычных сообщениях ВК.

## Быстрый старт

```bash
cd vk-mini-app
cp .env.example .env
# заполните VITE_API_BASE_URL, VITE_VK_GROUP_ID, VITE_MAIN_WEB_URL
npm install
npm run start
```

Дальше в кабинете разработчика ВК: **Настройки → Размещение → режим разработки** укажите HTTPS-URL (ngrok, cloudflared, деплой). VK Tunnel с октября 2025 может быть недоступен — используйте сторонний туннель или сразу `npm run build` + хостинг ВК.

## Прод: хостинг ВК

1. В [vk-hosting-config.json](./vk-hosting-config.json) подставьте `app_id` вашего мини-приложения.
2. `npm run build`
3. `npx @vkontakte/vk-miniapps-deploy` (как в документации ВК) или свой CI.

## Переменные бэкенда (Nest)

| Переменная | Назначение |
|------------|------------|
| `VK_MINI_APP_SECRET` | Защищённый ключ приложения (проверка `sign`) |
| `VK_GROUP_MESSAGES_TOKEN` | Токен сообщества для API `messages.send` |
| `VK_GROUP_WELCOME_TEXT` | Текст первого сообщения пользователю |

Эндпоинт: `POST /vk/mini-app/session`, тело: `{ "launchParams": { ... } }` (все значения строками, как с клиента).

## Long ID

Идентификаторы пользователей ВК уже в диапазоне, который безопасно хранить в `Int64` / строке; в этом приложении мы передаём их в API как строки из `launchParams`.
