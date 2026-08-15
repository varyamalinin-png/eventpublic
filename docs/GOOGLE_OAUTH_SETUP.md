# Настройка Google OAuth для быстрой регистрации

## Это бесплатно! ✅

Google OAuth 2.0 полностью бесплатен для использования. Вам не нужно платить за:
- Создание проекта в Google Cloud Console
- Создание OAuth 2.0 Client ID
- Использование Google Sign-In для аутентификации пользователей
- Количество запросов (в разумных пределах для обычного приложения)

## Пошаговая инструкция

### 1. Создание проекта в Google Cloud Console

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Войдите в свой Google аккаунт
3. Нажмите на выпадающий список проектов вверху страницы
4. Нажмите "Новый проект"
5. Введите название проекта (например, "Event App")
6. Нажмите "Создать"

### 2. Включение Google+ API

1. В меню слева выберите "APIs & Services" > "Library"
2. Найдите "Google+ API" или "Google Identity"
3. Нажмите "Enable" (Включить)

**Примечание:** Google+ API устарел, но для OAuth 2.0 обычно достаточно просто создать OAuth Client ID. Если возникнут проблемы, можно включить "Identity Toolkit API".

### 3. Настройка экрана согласия OAuth

1. Перейдите в "APIs & Services" > "OAuth consent screen"
2. Выберите тип пользователя:
   - **External** (внешний) - для публичного приложения (рекомендуется)
   - **Internal** (внутренний) - только для пользователей вашей организации
3. Заполните обязательные поля:
   - **App name** (Название приложения): Event App
   - **User support email** (Email поддержки): ваш email
   - **Developer contact information** (Контактная информация разработчика): ваш email
4. Нажмите "Save and Continue"
5. На шаге "Scopes" нажмите "Save and Continue" (можно добавить дополнительные разрешения позже)
6. На шаге "Test users" (если выбрали External) можно добавить тестовых пользователей или пропустить
7. Нажмите "Back to Dashboard"

### 4. Создание OAuth 2.0 Client ID

1. Перейдите в "APIs & Services" > "Credentials"
2. Нажмите "Create Credentials" > "OAuth client ID"
3. Если появится предупреждение о настройке экрана согласия, нажмите "Configure Consent Screen" и завершите настройку из шага 3
4. Выберите тип приложения:
   - **Web application** (Веб-приложение) - для веб-версии
   - **iOS** - для iOS приложения
   - **Android** - для Android приложения

#### Для веб-приложения:

1. Выберите "Web application"
2. Введите название (например, "Event App Web")
3. В разделе "Authorized redirect URIs" добавьте:
   ```
   https://iventapp.ru/auth
   ```
   (или ваш домен)
4. Нажмите "Create"
5. **Скопируйте Client ID** - это будет ваш `GOOGLE_CLIENT_ID` для сервера/ Client ID
<ваш GOOGLE_CLIENT_ID из Google Cloud Console>
Client secret
<ваш GOOGLE_CLIENT_SECRET из Google Cloud Console — не коммитьте его в git>

#### Для iOS приложения:

1. Выберите "iOS"
2. Введите название (например, "Event App iOS")
3. Введите Bundle ID: `com.varyamalinina.iwent`
4. Нажмите "Create"
5. **Скопируйте Client ID** - это будет ваш `EXPO_PUBLIC_GOOGLE_CLIENT_ID` для клиента

#### Для Android приложения:

1. Выберите "Android"
2. Введите название (например, "Event App Android")
3. Введите Package name: `com.varyamalinina.iwent`
4. Введите SHA-1 certificate fingerprint (можно получить позже, если нужно)
5. Нажмите "Create"
6. **Скопируйте Client ID** - это будет ваш `EXPO_PUBLIC_GOOGLE_CLIENT_ID` для клиента

**Важно:** Для мобильных приложений (iOS/Android) через Expo обычно используется один и тот же Client ID для веб-приложения, так как Expo использует веб-поток OAuth.

### 5. Настройка переменных окружения

#### На сервере:

Добавьте в файл `.env` на сервере (или в переменные окружения Yandex Cloud):

```bash
GOOGLE_CLIENT_ID=ваш-client-id-из-google-console
GOOGLE_CLIENT_SECRET=ваш-client-secret-из-google-console
```

**Примечание:** `GOOGLE_CLIENT_SECRET` нужен только для серверной верификации токенов. Для мобильных приложений через Expo обычно используется только Client ID.

#### В клиенте:

Создайте файл `client/.env` (если его нет) и добавьте:

```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=ваш-client-id-из-google-console
```

**Важно:** Для Expo переменные окружения должны начинаться с `EXPO_PUBLIC_`, чтобы быть доступными в клиентском коде.

### 6. Настройка Redirect URIs для мобильных приложений

Для мобильных приложений через Expo используется веб-поток OAuth, поэтому:

1. В Google Cloud Console перейдите к вашему OAuth Client ID (тип "Web application")
2. Добавьте в "Authorized redirect URIs":
   ```
   https://auth.expo.io/@your-expo-username/iwent
   ```
   или используйте автоматический redirect URI, который Expo генерирует

3. Для локальной разработки Expo автоматически создаст redirect URI вида:
   ```
   exp://localhost:8081
   ```

**Альтернативный подход:** Использовать один и тот же Web Client ID для всех платформ (веб, iOS, Android), так как Expo использует веб-поток OAuth.

### 7. Проверка работы

1. Перезапустите сервер после добавления переменных окружения
2. Перезапустите клиентское приложение
3. На странице логина/регистрации должна появиться кнопка "🔵 Продолжить с Google"
4. При нажатии должно открыться окно авторизации Google
5. После успешной авторизации пользователь должен быть автоматически зарегистрирован и авторизован

## Важные замечания

1. **Безопасность:** Никогда не коммитьте файлы `.env` с реальными ключами в Git
2. **Тестирование:** Для тестирования можно использовать тестовых пользователей в OAuth consent screen
3. **Production:** Перед публикацией убедитесь, что OAuth consent screen настроен для production
4. **Лимиты:** Google OAuth имеет лимиты на количество запросов, но для обычного приложения они очень высокие и бесплатные

## Troubleshooting

### Ошибка "redirect_uri_mismatch"
- Убедитесь, что redirect URI точно совпадает с тем, что указан в Google Cloud Console
- Для Expo используйте автоматически сгенерированный redirect URI

### Ошибка "invalid_client"
- Проверьте, что Client ID правильно скопирован
- Убедитесь, что переменные окружения установлены и доступны

### Кнопка Google не появляется
- Проверьте, что `EXPO_PUBLIC_GOOGLE_CLIENT_ID` установлен в `.env` файле клиента
- Перезапустите Expo после изменения `.env` файла

## Дополнительные ресурсы

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Expo AuthSession Documentation](https://docs.expo.dev/guides/authentication/#google)
- [Google Cloud Console](https://console.cloud.google.com/)

