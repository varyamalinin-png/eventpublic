# Продление SSL-сертификата iventapp.ru

Сайт использует Let's Encrypt (certbot). Сертификат действует **90 дней** и должен продлеваться до истечения срока.

## Когда сайт «недоступен» из-за SSL

- Браузер показывает «Ваше подключение не защищено» / «Certificate expired».
- `curl https://iventapp.ru/` даёт ошибку (exit code 60).

При этом сервер может быть включён и отдавать страницы — отказ из-за **истёкшего сертификата**.

## Как продлить сертификат

**Хост:** iventapp.ru указывает на **158.160.67.4** (VM event-app-backend-v2 в Yandex Cloud). Подключение по ключу `~/.ssh/yandex-cloud`.

1. Подключитесь к серверу:
   ```bash
   ssh -i ~/.ssh/yandex-cloud ubuntu@158.160.67.4
   ```

2. Продлите сертификат и примените его в nginx:
   ```bash
   sudo certbot renew --nginx
   sudo systemctl reload nginx
   ```

3. Проверьте в браузере: https://iventapp.ru/

**Или одной командой с локальной машины (без входа в сессию):**
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@158.160.67.4 "sudo certbot renew --nginx --non-interactive --no-random-sleep-on-renew --force-renewal"
```

## Автопродление (рекомендуется)

На VM уже может быть настроен cron для certbot. Проверить:
```bash
sudo systemctl status certbot.timer
# или
sudo cat /etc/cron.d/certbot
```

Если таймера нет, добавьте в crontab (от root):
```bash
0 3 * * * certbot renew --quiet --nginx
```

## Проверка срока действия сертификата

Локально:
```bash
echo | openssl s_client -servername iventapp.ru -connect iventapp.ru:443 2>/dev/null | openssl x509 -noout -dates
```

На сервере:
```bash
sudo openssl x509 -in /etc/letsencrypt/live/iventapp.ru/fullchain.pem -noout -dates
```
