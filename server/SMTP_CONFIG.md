# Настройка SMTP для отправки писем

## Mail.ru SMTP (рекомендуется для российских email)

```
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_USER=ваш_email@mail.ru
SMTP_PASSWORD=пароль_приложения
SMTP_SECURE=false
```

## Gmail SMTP

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ваш_email@gmail.com
SMTP_PASSWORD=пароль_приложения
SMTP_SECURE=false
```

## Как получить пароль приложения:

### Mail.ru:
1. Войдите в настройки почты
2. Безопасность → Пароли приложений
3. Создайте новый пароль для приложения
4. Используйте этот пароль в SMTP_PASSWORD

### Gmail:
1. Google Account → Security
2. 2-Step Verification → App passwords
3. Создайте пароль для приложения
4. Используйте этот пароль в SMTP_PASSWORD

