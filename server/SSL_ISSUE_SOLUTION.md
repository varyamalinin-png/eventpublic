# 🔧 Решение проблемы с SSL сертификатом

## ⚠️ Проблема

Let's Encrypt пытается подключиться через IPv6 (2a00:f940:2:2:1:1:0:290), но получает 404 ошибку. Это происходит потому, что:

1. DNS возвращает IPv6 адрес для домена
2. Но на VM нет публичного IPv6 адреса или он не настроен правильно
3. Let's Encrypt не может проверить домен через IPv6

## ✅ Решения

### Вариант 1: Отключить IPv6 для домена (РЕКОМЕНДУЕТСЯ)

В панели управления DNS провайдера удалите все AAAA записи (IPv6) для домена `iventapp.ru` и `www.iventapp.ru`. Оставьте только A записи (IPv4) с IP `89.169.173.152`.

После этого подождите 5-10 минут и попробуйте снова:

```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152
sudo systemctl stop nginx
sudo certbot certonly --standalone -d iventapp.ru -d www.iventapp.ru --non-interactive --agree-tos --email noreply@iventapp.ru
sudo systemctl start nginx
```

### Вариант 2: Использовать DNS challenge

Если у вас есть API ключ от DNS провайдера (REG.RU, Timeweb и т.д.), можно использовать DNS challenge вместо HTTP:

```bash
# Для REG.RU (пример)
sudo certbot certonly --manual --preferred-challenges dns -d iventapp.ru -d www.iventapp.ru
```

Но это требует ручного добавления TXT записей в DNS.

### Вариант 3: Настроить IPv6 на VM

Если хотите использовать IPv6, нужно:
1. Настроить IPv6 на VM в Yandex Cloud
2. Добавить IPv6 адрес в DNS записи
3. Открыть порты для IPv6 в Security Groups

## 🎯 Рекомендация

**Используйте Вариант 1** - это самый простой и быстрый способ. Большинство пользователей используют IPv4, поэтому IPv6 не обязателен.

## 📋 После решения проблемы

После получения SSL сертификата выполните:

```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152
cd ~/event_app_new/server
sudo tee /etc/nginx/sites-available/iventapp.ru > /dev/null << 'NGINX'
server {
    listen 80;
    server_name iventapp.ru www.iventapp.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name iventapp.ru www.iventapp.ru;

    ssl_certificate /etc/letsencrypt/live/iventapp.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/iventapp.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    access_log /var/log/nginx/iventapp.ru.access.log;
    error_log /var/log/nginx/iventapp.ru.error.log;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
sudo nginx -t && sudo systemctl reload nginx
```

