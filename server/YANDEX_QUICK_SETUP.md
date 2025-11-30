# Быстрая настройка Yandex Cloud Email API

## ✅ Что у вас уже есть:
- Сервисный аккаунт (ID: ajeckfmnubc21egtqna6)
- Приватный ключ
- Домен iventapp.ru (Active)

## ❌ Что нужно сделать:

### Шаг 1: Получить IAM токен

**Способ A (проще):**
1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru/)
2. Перейдите к сервисному аккаунту `email-sender`
3. Вкладка **Ключи** → **Создать новый ключ** → **IAM токен**
4. Скопируйте токен (показывается один раз!)

**Способ B (из приватного ключа):**
```bash
cd server
node scripts/get-yandex-iam-token.js
```

### Шаг 2: Создать email адрес в Postbox

1. Откройте [Yandex Cloud Postbox](https://console.cloud.yandex.ru/)
2. Выберите домен `iventapp.ru`
3. Создайте адрес (например: `noreply@iventapp.ru` или `postmaster@iventapp.ru`)
4. Верифицируйте адрес (проверьте почту и подтвердите)

### Шаг 3: Добавить переменные в Railway

Добавьте в Railway Dashboard → Variables:

```
YANDEX_IAM_TOKEN=ваш_iam_токен_из_шага_1
YANDEX_CLOUD_FROM_EMAIL=ваш_email@iventapp.ru
```

**Готово!** Railway перезапустится и будет использовать Yandex Cloud Email API.

