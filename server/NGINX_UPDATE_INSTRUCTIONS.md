# Инструкция по обновлению конфигурации nginx

## Проблема
Ошибка 405 Not Allowed при создании папок событий (`/event-folders`) из-за отсутствия правила проксирования в nginx.

## Решение
Добавлены правила проксирования для:
- `/event-folders` - папки событий
- `/user-folders` - папки пользователей

## Шаги для применения на сервере

### 1. Подключитесь к серверу по SSH
```bash
ssh user@your-server-ip
```

### 2. Скопируйте обновленную конфигурацию
Скопируйте содержимое файла `server/nginx-iventapp-fix.conf` в файл на сервере:
```bash
sudo nano /etc/nginx/sites-available/iventapp.ru
```

Или используйте scp для копирования файла:
```bash
# С локальной машины
scp server/nginx-iventapp-fix.conf user@your-server-ip:/tmp/nginx-iventapp-fix.conf

# На сервере
sudo cp /tmp/nginx-iventapp-fix.conf /etc/nginx/sites-available/iventapp.ru
```

### 3. Проверьте конфигурацию nginx
```bash
sudo nginx -t
```

Должно вывести:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 4. Перезагрузите nginx
```bash
sudo systemctl reload nginx
```

Или:
```bash
sudo service nginx reload
```

### 5. Проверьте, что nginx работает
```bash
sudo systemctl status nginx
```

### 6. Проверьте логи (если что-то пошло не так)
```bash
sudo tail -f /var/log/nginx/iventapp.ru.error.log
```

## Что было добавлено

### Правило для `/event-folders`:
```nginx
location ^~ /event-folders {
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
    client_max_body_size 5M; # Увеличиваем лимит для загрузки обложек папок
}
```

### Правило для `/user-folders`:
```nginx
location ^~ /user-folders {
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
```

## Проверка после применения

После применения конфигурации проверьте, что запросы работают:

```bash
# Проверка создания папки событий
curl -X POST https://iventapp.ru/event-folders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Folder","description":"Test"}'

# Должен вернуть 201 Created или 200 OK, а не 405 Not Allowed
```

## Важные замечания

1. **Порядок location важен!** Правила для `/event-folders` и `/user-folders` должны быть **перед** правилом для `/events` и `/users` соответственно, так как они более специфичные.

2. **Проверьте, что NestJS приложение запущено** на порту 4000:
```bash
sudo netstat -tlnp | grep 4000
# или
sudo ss -tlnp | grep 4000
```

3. **Если что-то пошло не так**, можно откатить изменения:
```bash
sudo cp /etc/nginx/sites-available/iventapp.ru.backup /etc/nginx/sites-available/iventapp.ru
sudo nginx -t
sudo systemctl reload nginx
```

## Автоматическое применение (опционально)

Если у вас есть доступ к серверу через SSH ключи, можно создать скрипт для автоматического применения:

```bash
#!/bin/bash
# apply-nginx-config.sh

SERVER_USER="your-user"
SERVER_IP="your-server-ip"
CONFIG_FILE="server/nginx-iventapp-fix.conf"

scp "$CONFIG_FILE" "$SERVER_USER@$SERVER_IP:/tmp/nginx-iventapp-fix.conf"

ssh "$SERVER_USER@$SERVER_IP" << 'EOF'
sudo cp /tmp/nginx-iventapp-fix.conf /etc/nginx/sites-available/iventapp.ru
sudo nginx -t && sudo systemctl reload nginx
echo "Nginx configuration updated successfully!"
EOF
```
