# ✅ ОКОНЧАТЕЛЬНОЕ РЕШЕНИЕ

## 🎯 Проблема найдена

**Корневая причина:** При создании VM через CLI SSH ключ может не применяться правильно, или SSH сервер не запускается автоматически.

## ✅ Решение: Новая VM через веб-консоль

### Создайте новую VM через веб-консоль:

1. **Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru)**
2. **Compute Cloud → Виртуальные машины → Создать виртуальную машину**

### Настройки VM:

- **Имя**: `event-app-backend-v2`
- **Зона доступности**: `ru-central1-b`
- **Образ**: `Ubuntu 22.04 LTS`
- **Вычислительные ресурсы**: 
  - vCPU: 2
  - RAM: 4GB
  - Гарантированная доля: 100%
- **Диск**: 20GB SSD
- **Сеть**: 
  - Подсеть: `default-ru-central1-b`
  - Публичный IP: Автоматически
  - **Группа безопасности**: `default-sg-enphv7p9hmf19tufcjd8` (там уже открыты порты)

### КРИТИЧЕСКИ ВАЖНО - Доступ:

1. **В разделе "Доступ" нажмите "Добавить ключ"**
2. **Выберите "Ввести вручную"**
3. **Вставьте публичный ключ:**
   ```
   ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDZewwNpteyUcXGqzc2BuE8E8gCXDVr5VzAetcnV8jFIbBAbLxshM6qoZy9t+F3BDRTlT1PSRSI5DIocFNlezdgEUNSkY2kUCcRnosioTi02YyjK/6atC83oDadf2qbxr0k5Owwv08Emc5FvE2n+qDErW4jCAslYQd8bp37zoSnVeFZtjNIU0+IodIHHYEBFYlnUTGokKBbPbYm3T5mcrCj6oYtBCOT42z6C4t2Rx0u4vqhzmv+r2DzZlbk9DTTXBw8dhoy0IaDo5bR4NDcrQQRkf8AyqXbPvwmK68a73/nFUaAzpYm/iuDO4FxcgjKHBqM+zFuzUE7+tToTdlMIXJ0mcnUUtLgxvLFGPCVYZq6NSi2Cx96r9xqSXJw2xn2cQRB0G2pUWyWsxkmY98C8rpryd3qYvNUoeEBxu1JJy23P1hf42MIBYsTj3O2MtHQvvD8V6bt5kjt4y6eVaXUVHPh7Uj7OWWTLlHZM7lXTILG3J7udK+X+2vOodEQrI7L0/BPee9hZj4By8mr937Rj7gt0hRo+JWF9dRptDJdecgZxpxIsRtAt6xn9YoWFHkkO/l0dq4yX0e9ea9J8p/RljDukTbmYPCoCs57f0kAqA2vmIKkyJPFIJWMI81SGquVm6TNQ79rAD0SNkh/w48sNVAowFQwpGSnNtxc7NfMGbqenQ== yandex-cloud-vm
   ```
4. **Доступ по OS Login**: Выключен
5. **Серийная консоль**: Включена (опционально)

### Создайте VM

## 🔗 После создания

1. **Подождите 2-3 минуты** после создания
2. **Запишите IP адрес** новой VM
3. **Подключитесь через SSH:**
   ```bash
   ssh -i ~/.ssh/yandex-cloud ubuntu@<НОВЫЙ_IP>
   ```

## 📋 После подключения

Выполните команды для настройки:

```bash
# Установка зависимостей
sudo apt-get update
sudo apt-get install -y curl git build-essential postgresql postgresql-contrib redis-server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# Клонирование репозитория
cd ~
git clone https://github.com/varyamalinin-png/eventpublic.git event_app_new
cd event_app_new/server
npm install --legacy-peer-deps

# Настройка базы данных
sudo systemctl start postgresql
sudo systemctl enable postgresql
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres createdb event_app

# Создание .env
cat > .env << EOF
NODE_ENV=production
PORT=4000
CORS_ORIGIN=*

DATABASE_URL=postgresql://postgres:$DB_PASSWORD@localhost:5432/event_app
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

APP_BACKEND_BASE_URL=http://<НОВЫЙ_IP>:4000
APP_FRONTEND_BASE_URL=http://<НОВЫЙ_IP>:8081
APP_URL=http://<НОВЫЙ_IP>:4000

EMAIL_VERIFICATION_REDIRECT_URL=http://<НОВЫЙ_IP>:8081/auth/verify
PASSWORD_RESET_REDIRECT_URL=http://<НОВЫЙ_IP>:8081/auth/reset

YANDEX_CLOUD_API_ENDPOINT=https://mail-api.cloud.yandex.net
YANDEX_CLOUD_FROM_EMAIL=noreply@iventapp.ru

STORAGE_DRIVER=s3
STORAGE_MAX_FILE_SIZE_MB=5
EOF

# Применение миграций и сборка
npx prisma db push --accept-data-loss
npm run build

# Запуск приложения
pm2 start dist/src/main.js --name event-app
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Выполните команду, которую выдаст PM2, с sudo

# Проверка
pm2 status
curl http://localhost:4000/health
```

## ✅ Готово!

После выполнения всех команд приложение будет доступно по адресу:
- **API**: http://<НОВЫЙ_IP>:4000
- **Health**: http://<НОВЫЙ_IP>:4000/health

**Используйте этот адрес в мобильном приложении!**

