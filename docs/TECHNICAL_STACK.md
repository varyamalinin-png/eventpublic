# Технический стек проекта Event App

Полное описание всех технологий, языков программирования, фреймворков, инфраструктуры и инструментов, используемых в проекте.

---

## 1. Языки программирования

### Основные языки
- **TypeScript** (v5.4.2 - v5.9.2)
  - Основной язык для разработки клиентской и серверной частей
  - Используется для типобезопасности и улучшения качества кода
  - Применяется в React Native, Next.js и NestJS приложениях

- **JavaScript** (ES6+)
  - Используется в конфигурационных файлах и скриптах
  - Поддерживается через Babel для совместимости

### Мобильная разработка
- **Swift** (iOS)
  - Нативные модули для iOS
  - Интеграция с Expo и React Native

- **Kotlin** (Android)
  - Нативные модули для Android
  - Интеграция с Expo и React Native

---

## 2. Фреймворки и библиотеки

### Frontend (Клиентская часть)

#### Мобильное приложение
- **React Native** (v0.81.5)
  - Кроссплатформенный фреймворк для iOS и Android
  - Основа мобильного приложения

- **Expo** (v54.0.27)
  - Платформа для разработки React Native приложений
  - Управление нативными модулями и сборкой
  - Expo Router (v6.0.17) для навигации
  - Expo SDK модули:
    - `expo-auth-session` - OAuth аутентификация
    - `expo-image-picker` - Выбор изображений
    - `expo-location` - Геолокация
    - `expo-secure-store` - Безопасное хранение данных
    - `expo-av` - Работа с медиа
    - `expo-blur` - Эффекты размытия
    - `expo-haptics` - Тактильная обратная связь
    - `expo-image` - Оптимизированная загрузка изображений
    - `expo-image-manipulator` - Обработка изображений

- **React Navigation** (v7.x)
  - `@react-navigation/native` - Базовая навигация
  - `@react-navigation/bottom-tabs` - Нижняя таб-навигация
  - `@react-navigation/elements` - UI элементы навигации

- **React Native Gesture Handler** (v2.28.0)
  - Обработка жестов и свайпов
  - Используется для интерактивных элементов

- **React Native Reanimated** (v4.1.1)
  - Высокопроизводительные анимации
  - Работа на UI потоке

- **React Native Maps** (v1.20.1)
  - Интеграция карт для мобильных платформ
  - Поддержка Google Maps и Apple Maps

- **React Native WebView** (v13.15.0)
  - Встраивание веб-контента в мобильное приложение

#### Веб-приложение
- **Next.js** (v15.1.0)
  - React фреймворк для продакшн веб-версии
  - Server-Side Rendering (SSR)
  - Static Site Generation (SSG)
  - App Router для маршрутизации

- **React** (v19.1.0)
  - UI библиотека для веб и мобильных платформ
  - React DOM (v19.1.0) для веб-рендеринга

- **React Native Web** (v0.21.0)
  - Адаптация React Native компонентов для веба
  - Позволяет использовать один код для мобильных и веб-платформ

#### Общие библиотеки
- **Socket.IO Client** (v4.8.1)
  - WebSocket клиент для real-time коммуникации
  - Используется для чатов и уведомлений

- **AsyncStorage** (v2.2.0)
  - Локальное хранилище данных на мобильных устройствах

- **React Native Safe Area Context** (v5.6.0)
  - Обработка безопасных зон экрана (notch, status bar)

- **React Native Screens** (v4.16.0)
  - Нативные экраны для улучшения производительности

### Backend (Серверная часть)

- **NestJS** (v10.0.0)
  - Прогрессивный Node.js фреймворк
  - Модульная архитектура
  - Встроенная поддержка TypeScript
  - Dependency Injection
  - Модули:
    - `@nestjs/common` - Основные утилиты
    - `@nestjs/core` - Ядро фреймворка
    - `@nestjs/config` - Управление конфигурацией
    - `@nestjs/jwt` - JWT аутентификация
    - `@nestjs/passport` - Passport интеграция
    - `@nestjs/platform-express` - Express адаптер
    - `@nestjs/platform-socket.io` - Socket.IO адаптер
    - `@nestjs/websockets` - WebSocket поддержка
    - `@nestjs/throttler` - Rate limiting
    - `@nestjs/terminus` - Health checks

- **Prisma** (v5.15.0)
  - ORM для работы с базой данных
  - Type-safe database client
  - Миграции и схема базы данных
  - Prisma Client для запросов

- **Fastify** (v4.26.0)
  - Быстрый веб-фреймворк (альтернатива Express)
  - Используется как HTTP адаптер

- **Socket.IO** (v8.3.0)
  - Real-time двусторонняя коммуникация
  - WebSocket с fallback на HTTP long-polling
  - Redis адаптер для масштабирования

- **Passport** (v0.7.0)
  - Аутентификация middleware
  - Стратегии:
    - `passport-jwt` (v4.0.1) - JWT токены
    - `passport-local` (v1.0.0) - Email/Password

- **Argon2** (v0.31.0)
  - Хеширование паролей
  - Современный и безопасный алгоритм

- **Class Validator** (v0.14.0)
  - Валидация DTO и входных данных
  - Декораторы для валидации

- **Class Transformer** (v0.5.1)
  - Преобразование объектов
  - Сериализация и десериализация

- **Joi** (v18.0.1)
  - Схемы валидации конфигурации

- **Sharp** (v0.34.5)
  - Обработка и оптимизация изображений
  - Конвертация форматов (WebP, PNG, JPEG)
  - Изменение размера и сжатие

- **Multer** (v1.4.5)
  - Обработка multipart/form-data
  - Загрузка файлов

- **Google Auth Library** (v10.5.0)
  - OAuth 2.0 аутентификация через Google
  - Верификация ID токенов

- **SendGrid** (v8.1.6)
  - Email сервис для отправки писем
  - Верификация email и восстановление пароля

- **Resend** (v6.5.2)
  - Альтернативный email сервис

- **Nodemailer** (v7.0.10)
  - Универсальный email клиент

- **RxJS** (v7.8.1)
  - Реактивное программирование
  - Используется в NestJS для обработки событий

---

## 3. Базы данных

### PostgreSQL (v14+ / v15)
- **Основная реляционная база данных**
- Хранение пользователей, событий, чатов, друзей
- Используется через Prisma ORM
- Версия в production: PostgreSQL 15 (из docker-compose)

### Redis (v6+ / v7)
- **In-memory хранилище данных**
- Используется для:
  - Кэширования данных
  - Сессий и токенов
  - WebSocket адаптера (Socket.IO Redis Adapter)
  - Очередей задач
- Версия в development: Redis 7 (из docker-compose)

---

## 4. Хранилище файлов

### S3-совместимое хранилище
- **MinIO** (RELEASE.2024-09-13T20-26-02Z)
  - Локальное S3-совместимое хранилище для разработки
  - Используется через AWS SDK

- **AWS S3 SDK** (@aws-sdk/client-s3 v3.929.0)
  - Клиент для работы с S3-совместимым хранилищем
  - Загрузка и управление медиа файлами
  - Presigned URLs для безопасной загрузки

### Оптимизация медиа
- **Sharp** (v0.34.5)
  - Автоматическая оптимизация изображений при загрузке
  - Конвертация в WebP формат
  - Изменение размера и сжатие
  - Используется для аватаров и медиа событий

---

## 5. Инфраструктура и облачные сервисы

### Yandex Cloud
- **Виртуальная машина (VM)**
  - IP адрес: `158.160.67.4` (production, iventapp.ru)
  - ОС: Ubuntu
  - Пользователь: `ubuntu`
  - Используется для хостинга:
    - Next.js веб-приложения (порт 3000)
    - NestJS backend API (порт 4000)
    - Nginx reverse proxy (порты 80, 443)

- **Compute Cloud**
  - Виртуальные машины для развертывания приложений
  - Security Groups для управления сетевым доступом

- **VPC (Virtual Private Cloud)**
  - Управление сетевой инфраструктурой
  - Security Groups для firewall правил

### Контейнеризация
- **Docker**
  - Используется для локальной разработки
  - Docker Compose для оркестрации сервисов

- **Docker Compose** (v3.9)
  - Оркестрация локальных сервисов:
    - PostgreSQL 15
    - Redis 7
    - MinIO

### Process Manager
- **PM2** (на production VM)
  - Управление Node.js процессами
  - Автоматический перезапуск при сбоях
  - Логирование и мониторинг
  - Используется для запуска Next.js и NestJS приложений

### Web Server
- **Nginx**
  - Reverse proxy для веб-приложения
  - SSL/TLS терминация (HTTPS)
  - Статическая раздача файлов
  - Балансировка нагрузки

### Build Tools
- **Nixpacks**
  - Используется для автоматической сборки на Yandex Cloud
  - Конфигурация в `server/nixpacks.toml`
  - Node.js 18 и npm 9.x

---

## 6. Инструменты разработки

### Package Managers
- **npm** (v9.x)
  - Основной менеджер пакетов
  - Используется для установки зависимостей

- **pnpm / yarn** (опционально)
  - Альтернативные менеджеры пакетов
  - Поддерживаются в проекте

### Build Tools
- **Babel** (@babel/core v7.25.2)
  - Транспиляция JavaScript/TypeScript
  - Используется в Expo и React Native

- **Metro Bundler**
  - Бандлер для React Native
  - Используется Expo для сборки мобильных приложений
  - Порт по умолчанию: 8081

- **TypeScript Compiler** (tsc)
  - Компиляция TypeScript в JavaScript
  - Используется в NestJS и Next.js

### Code Quality
- **ESLint** (v8.57.0 - v9.25.0)
  - Линтинг кода
  - Конфигурации:
    - `eslint-config-expo` для мобильного приложения
    - `eslint-config-prettier` для сервера

- **Prettier** (v3.2.5)
  - Форматирование кода
  - Единый стиль кода в проекте

- **Jest** (v29.7.0)
  - Тестирование (unit tests)
  - Используется в NestJS проекте

### Version Control
- **Git**
  - Система контроля версий
  - Хостинг: вероятно GitHub/GitLab

### Deployment Scripts
- **Bash скрипты**
  - `deploy-nextjs-to-vm.sh` - Деплой веб-приложения
  - `setup-metro-on-vm.sh` - Настройка Metro bundler на VM
  - `apply-nginx-config.sh` - Применение конфигурации Nginx
  - Используют SSH и rsync для деплоя

---

## 7. API и интеграции

### REST API
- **NestJS REST API**
  - Endpoints для:
    - Аутентификации (`/auth/*`)
    - Пользователей (`/users/*`)
    - Событий (`/events/*`)
    - Чатов (`/chats/*`)
    - Друзей (`/friends/*`)
    - Папок (`/folders/*`)

### WebSocket API
- **Socket.IO**
  - Namespace: `/ws/chats`
  - Real-time события:
    - `chat:join` - Присоединение к чату
    - `message:send` - Отправка сообщения
    - `message:new` - Новое сообщение
    - `chats:update` - Обновление списка чатов

### Внешние API
- **Google OAuth 2.0**
  - Аутентификация через Google аккаунт
  - Используется в мобильном и веб-приложениях

- **Yandex Maps API**
  - Карты для веб-версии
  - Геокодирование и поиск адресов
  - Используется на странице выбора локации

- **Apple Maps / Google Maps**
  - Нативные карты для мобильных приложений
  - Через React Native Maps

---

## 8. Безопасность

### Аутентификация и авторизация
- **JWT (JSON Web Tokens)**
  - Access tokens (TTL: 15 минут)
  - Refresh tokens (TTL: 7 дней)
  - Используется для stateless аутентификации

- **Argon2**
  - Хеширование паролей
  - Современный и безопасный алгоритм

- **Passport.js**
  - Middleware для аутентификации
  - Поддержка различных стратегий

### Защита
- **Helmet** (@fastify/helmet v12.0.0)
  - Заголовки безопасности HTTP
  - Защита от XSS, CSRF и других атак

- **Throttler** (@nestjs/throttler v5.0.0)
  - Rate limiting
  - Защита от DDoS и злоупотреблений

- **Cookie Parser** (v1.4.6)
  - Безопасная работа с cookies
  - HttpOnly и Secure флаги

---

## 9. Мониторинг и логирование

### Health Checks
- **Terminus** (@nestjs/terminus v10.0.0)
  - Проверка здоровья сервисов
  - Endpoints для мониторинга

### Process Management
- **PM2**
  - Мониторинг процессов на production
  - Автоматический перезапуск
  - Логирование

---

## 10. Платформы и окружения

### Мобильные платформы
- **iOS**
  - Минимальная версия: определяется в `app.json`
  - Нативная сборка через Xcode
  - Использует Swift для нативных модулей

- **Android**
  - Минимальная версия: определяется в `app.json`
  - Нативная сборка через Gradle
  - Использует Kotlin для нативных модулей

### Веб-платформы
- **Браузеры**
  - Современные браузеры с поддержкой ES6+
  - Chrome, Firefox, Safari, Edge

### Окружения
- **Development**
  - Локальная разработка
  - Hot reload и dev tools
  - Docker Compose для инфраструктуры

- **Production**
  - Yandex Cloud VM
  - PM2 для управления процессами
  - Nginx для reverse proxy
  - SSL/TLS сертификаты

---

## 11. Структура проекта

```
event_app_new/
├── client/              # React Native мобильное приложение (Expo)
│   ├── app/            # Экранные компоненты (Expo Router)
│   ├── components/     # Переиспользуемые компоненты
│   ├── context/        # React Context провайдеры
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API сервисы
│   ├── utils/          # Утилиты
│   └── web/            # Веб-версия через Expo Web
│
├── web/                # Next.js продакшн веб-приложение
│   ├── src/
│   │   ├── app/        # Next.js App Router страницы
│   │   └── components/ # React компоненты
│   └── public/         # Статические файлы
│
├── server/              # NestJS backend API
│   ├── prisma/         # Prisma схема и миграции
│   └── src/
│       ├── auth/       # Модуль аутентификации
│       ├── users/      # Модуль пользователей
│       ├── events/     # Модуль событий
│       ├── chats/      # Модуль чатов
│       ├── friends/    # Модуль друзей
│       ├── folders/    # Модуль папок
│       └── storage/     # Модуль хранилища файлов
│
├── docs/               # Документация проекта
├── scripts/            # Скрипты деплоя и утилиты
└── docker-compose.dev.yml  # Docker Compose конфигурация
```

---

## 12. Версии и требования

### Node.js
- **Требуется**: Node.js 18+
- **Используется в production**: Node.js 18 (через Nixpacks)

### Базы данных
- **PostgreSQL**: 14+ (рекомендуется 15)
- **Redis**: 6+ (рекомендуется 7)

### Пакетные менеджеры
- **npm**: 9.x
- **pnpm / yarn**: опционально

---

## 13. Дополнительные инструменты

### Разработка
- **Expo CLI**
  - Команды для разработки Expo приложений
  - `expo start`, `expo run:ios`, `expo run:android`

- **NestJS CLI**
  - Генерация модулей и компонентов
  - `nest generate`

- **Prisma CLI**
  - Управление миграциями
  - `prisma migrate`, `prisma generate`

### Деплой
- **SSH**
  - Подключение к виртуальным машинам
  - Ключ: `~/.ssh/yandex-cloud`

- **rsync**
  - Синхронизация файлов при деплое
  - Используется в скриптах деплоя

---

## 14. Ссылки и документация

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Yandex Cloud Documentation](https://cloud.yandex.ru/docs/)

---

**Последнее обновление**: Декабрь 2024
