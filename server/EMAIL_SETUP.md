# Инструкция по настройке отправки email через SMTP

Этот документ содержит инструкции по настройке отправки писем подтверждения email через SMTP с использованием вашей личной почты.

## Варианты настройки

### Вариант 1: Gmail (Рекомендуется для начала)

#### Шаг 1: Включить двухфакторную аутентификацию
1. Перейдите в [настройки аккаунта Google](https://myaccount.google.com/)
2. Перейдите в "Безопасность"
3. Включите "Двухэтапную аутентификацию"

#### Шаг 2: Создать пароль приложения
1. После включения двухфакторной аутентификации, перейдите на страницу [Пароли приложений](https://myaccount.google.com/apppasswords)
2. Выберите "Почта" и "Другое устройство" (укажите название, например "Event App")
3. Нажмите "Создать"
4. Скопируйте сгенерированный 16-значный пароль (он понадобится для SMTP_PASSWORD)

#### Шаг 3: Настроить переменные окружения
Добавьте в файл `server/.env`:

```env
# SMTP настройки для Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-digit-app-password
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:8081/(auth)/verify-email
PASSWORD_RESET_REDIRECT_URL=http://localhost:8081/(auth)/login?mode=reset
```

**Важно:**
- `SMTP_USER` - ваш полный email адрес Gmail
- `SMTP_PASSWORD` - пароль приложения (16 символов), не ваш обычный пароль Gmail
- `SMTP_SECURE=false` для порта 587 (STARTTLS)
- `SMTP_SECURE=true` для порта 465 (SSL)

---

### Вариант 2: Yandex Mail

#### Шаг 1: Включить пароль приложения
1. Перейдите в [настройки безопасности Яндекса](https://id.yandex.ru/security/)
2. Включите двухфакторную аутентификацию (если еще не включена)
3. Перейдите в раздел "Пароли приложений"
4. Создайте новый пароль для "Почты"
5. Скопируйте сгенерированный пароль

#### Шаг 2: Настроить переменные окружения
Добавьте в файл `server/.env`:

```env
# SMTP настройки для Yandex
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yandex.ru
SMTP_PASSWORD=your-app-password
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:8081/(auth)/verify-email
PASSWORD_RESET_REDIRECT_URL=http://localhost:8081/(auth)/login?mode=reset
```

**Важно:**
- Для Yandex используйте порт 465 с SSL (SMTP_SECURE=true)
- Или порт 587 с STARTTLS (SMTP_SECURE=false)
- `SMTP_USER` - ваш полный email адрес Yandex
- `SMTP_PASSWORD` - пароль приложения, не обычный пароль

---

### Вариант 3: Mail.ru

#### Шаг 1: Настроить пароль приложения
1. Перейдите в [настройки безопасности Mail.ru](https://account.mail.ru/user/password)
2. Включите двухфакторную аутентификацию
3. Создайте пароль приложения для почты

#### Шаг 2: Настроить переменные окружения
Добавьте в файл `server/.env`:

```env
# SMTP настройки для Mail.ru
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@mail.ru
SMTP_PASSWORD=your-app-password
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:8081/(auth)/verify-email
PASSWORD_RESET_REDIRECT_URL=http://localhost:8081/(auth)/login?mode=reset
```

---

### Вариант 4: Outlook/Hotmail

#### Шаг 1: Настроить пароль приложения
1. Перейдите в [настройки безопасности Microsoft](https://account.microsoft.com/security)
2. Включите двухфакторную аутентификацию
3. Перейдите в "Дополнительные параметры безопасности" > "Пароли приложений"
4. Создайте новый пароль приложения

#### Шаг 2: Настроить переменные окружения
Добавьте в файл `server/.env`:

```env
# SMTP настройки для Outlook
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-app-password
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:8081/(auth)/verify-email
PASSWORD_RESET_REDIRECT_URL=http://localhost:8081/(auth)/login?mode=reset
```

---

## Общие настройки SMTP

Для всех провайдеров в `server/.env`:

```env
# SMTP настройки (выберите один из вариантов выше)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password

# Email отправитель (обычно совпадает с SMTP_USER)
SENDGRID_FROM_EMAIL=your-email@example.com

# URL для редиректов после подтверждения
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:8081/(auth)/verify-email
PASSWORD_RESET_REDIRECT_URL=http://localhost:8081/(auth)/login?mode=reset

# Базовый URL бэкенда
APP_BACKEND_BASE_URL=http://localhost:4000
```

## Проверка работы

1. Установите зависимости (если еще не установлены):
   ```bash
   cd server
   npm install
   ```

2. Перезапустите сервер:
   ```bash
   npm run start:dev
   ```

3. Проверьте логи - должны увидеть:
   ```
   [MailerService] SMTP email service enabled (smtp.gmail.com:587)
   ```

4. Попробуйте зарегистрировать нового пользователя через приложение

5. Проверьте почту - должно прийти письмо с подтверждением

## Устранение проблем

### Проблема: "Authentication failed"
- Убедитесь, что используете **пароль приложения**, а не обычный пароль аккаунта
- Проверьте, что двухфакторная аутентификация включена
- Для Gmail: используйте пароль приложения из настроек безопасности

### Проблема: "Connection timeout"
- Проверьте, что порт правильный:
  - 587 с STARTTLS (SMTP_SECURE=false)
  - 465 с SSL (SMTP_SECURE=true)
- Проверьте файрвол - возможно, порт заблокирован

### Проблема: "Relay access denied"
- Убедитесь, что используете правильный SMTP_HOST для вашего провайдера
- Проверьте, что SMTP_USER - это полный email адрес

### Проблема: Письма не приходят
- Проверьте папку "Спам"
- Убедитесь, что переменные окружения правильно загружены (перезапустите сервер)
- Проверьте логи сервера на наличие ошибок отправки

## Отключение проверки email (для разработки)

Если хотите отключить проверку email в режиме разработки, просто не указывайте SMTP настройки в `.env`. В этом случае:
- Email не будет отправляться
- Новые пользователи будут автоматически верифицированы
- Соответствующее предупреждение появится в логах

