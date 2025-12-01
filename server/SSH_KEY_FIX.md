# 🔧 Исправление проблемы с SSH подключением

## ⚠️ Проблема

Порты открыты в Security Groups, но SSH все еще не работает. Это может быть из-за того, что SSH ключ не был правильно применен к пользователю `ubuntu` на VM.

## ✅ Решение: Добавить SSH ключ вручную через веб-консоль

### Шаг 1: Подключитесь через веб-консоль

1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru)
2. Compute Cloud → Виртуальные машины → `event-app-backend`
3. Нажмите **"Подключиться к ВМ по SSH"**
4. Вставьте приватный SSH ключ (который я давал ранее)
5. Логин: `ubuntu`
6. Нажмите "Подключиться"

### Шаг 2: Добавьте SSH ключ вручную

После подключения через веб-консоль выполните:

```bash
# 1. Создать директорию .ssh (если не существует)
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 2. Добавить публичный ключ в authorized_keys
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDZewwNpteyUcXGqzc2BuE8E8gCXDVr5VzAetcnV8jFIbBAbLxshM6qoZy9t+F3BDRTlT1PSRSI5DIocFNlezdgEUNSkY2kUCcRnosioTi02YyjK/6atC83oDadf2qbxr0k5Owwv08Emc5FvE2n+qDErW4jCAslYQd8bp37zoSnVeFZtjNIU0+IodIHHYEBFYlnUTGokKBbPbYm3T5mcrCj6oYtBCOT42z6C4t2Rx0u4vqhzmv+r2DzZlbk9DTTXBw8dhoy0IaDo5bR4NDcrQQRkf8AyqXbPvwmK68a73/nFUaAzpYm/iuDO4FxcgjKHBqM+zFuzUE7+tToTdlMIXJ0mcnUUtLgxvLFGPCVYZq6NSi2Cx96r9xqSXJw2xn2cQRB0G2pUWyWsxkmY98C8rpryd3qYvNUoeEBxu1JJy23P1hf42MIBYsTj3O2MtHQvvD8V6bt5kjt4y6eVaXUVHPh7Uj7OWWTLlHZM7lXTILG3J7udK+X+2vOodEQrI7L0/BPee9hZj4By8mr937Rj7gt0hRo+JWF9dRptDJdecgZxpxIsRtAt6xn9YoWFHkkO/l0dq4yX0e9ea9J8p/RljDukTbmYPCoCs57f0kAqA2vmIKkyJPFIJWMI81SGquVm6TNQ79rAD0SNkh/w48sNVAowFQwpGSnNtxc7NfMGbqenQ== yandex-cloud-vm" >> ~/.ssh/authorized_keys

# 3. Установить правильные права доступа
chmod 600 ~/.ssh/authorized_keys

# 4. Проверить
cat ~/.ssh/authorized_keys
```

### Шаг 3: Проверьте подключение через SSH

После добавления ключа попробуйте подключиться с вашего компьютера:

```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@51.250.105.190
```

Если подключится - отлично! Теперь можно работать через SSH.

## 🔄 Альтернатива: Пересоздать VM с правильным ключом

Если веб-консоль тоже не работает, можно пересоздать VM с правильным SSH ключом:

1. Удалите текущую VM
2. Создайте новую VM с SSH ключом в метаданных

Но это займет больше времени.

## 📋 После успешного SSH подключения

Выполните команды для запуска приложения:

```bash
cd ~/event_app_new/server
sudo systemctl start postgresql
sudo systemctl enable postgresql
npx prisma db push --accept-data-loss
pm2 delete event-app 2>/dev/null || true
pm2 start dist/main.js --name event-app
pm2 save
pm2 status
curl http://localhost:4000/health
```

## ✅ Резюме

1. Порты открыты ✅
2. Нужно добавить SSH ключ вручную через веб-консоль
3. После этого SSH будет работать
4. Затем запустить приложение

