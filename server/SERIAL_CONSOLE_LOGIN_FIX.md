# 🔐 Исправление входа в серийную консоль

## ⚠️ Проблема

Пароль для пользователя `ubuntu` неверный или не установлен.

## ✅ Решение 1: Попробовать стандартные варианты

В серийной консоли попробуйте:
- Логин: `ubuntu`, Пароль: `ubuntu`
- Логин: `ubuntu`, Пароль: пустой (просто Enter)
- Логин: `root`, Пароль: пустой
- Логин: `root`, Пароль: `root`

## ✅ Решение 2: Сброс пароля через метаданные

Я добавил user-data в метаданные VM с паролем. После перезапуска VM:

1. **Подождите 2-3 минуты** после перезапуска
2. **Попробуйте войти снова:**
   - Логин: `ubuntu`
   - Пароль: попробуйте пустой (Enter) или стандартные варианты

## ✅ Решение 3: Войти как root (если доступен)

Попробуйте:
- Логин: `root`
- Пароль: пустой или стандартные варианты

## ✅ Решение 4: Использовать SSH после перезапуска

После перезапуска VM с user-data, SSH должен заработать:

```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@84.201.179.62
```

## 📋 После входа в серийную консоль

Выполните команды для диагностики и исправления SSH:

```bash
# 1. Проверка SSH
sudo systemctl status ssh
sudo systemctl start ssh
sudo systemctl enable ssh

# 2. Проверка firewall
sudo ufw status
sudo ufw allow 22/tcp

# 3. Добавление SSH ключа
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDZewwNpteyUcXGqzc2BuE8E8gCXDVr5VzAetcnV8jFIbBAbLxshM6qoZy9t+F3BDRTlT1PSRSI5DIocFNlezdgEUNSkY2kUCcRnosioTi02YyjK/6atC83oDadf2qbxr0k5Owwv08Emc5FvE2n+qDErW4jCAslYQd8bp37zoSnVeFZtjNIU0+IodIHHYEBFYlnUTGokKBbPbYm3T5mcrCj6oYtBCOT42z6C4t2Rx0u4vqhzmv+r2DzZlbk9DTTXBw8dhoy0IaDo5bR4NDcrQQRkf8AyqXbPvwmK68a73/nFUaAzpYm/iuDO4FxcgjKHBqM+zFuzUE7+tToTdlMIXJ0mcnUUtLgxvLFGPCVYZq6NSi2Cx96r9xqSXJw2xn2cQRB0G2pUWyWsxkmY98C8rpryd3qYvNUoeEBxu1JJy23P1hf42MIBYsTj3O2MtHQvvD8V6bt5kjt4y6eVaXUVHPh7Uj7OWWTLlHZM7lXTILG3J7udK+X+2vOodEQrI7L0/BPee9hZj4By8mr937Rj7gt0hRo+JWF9dRptDJdecgZxpxIsRtAt6xn9YoWFHkkO/l0dq4yX0e9ea9J8p/RljDukTbmYPCoCs57f0kAqA2vmIKkyJPFIJWMI81SGquVm6TNQ79rAD0SNkh/w48sNVAowFQwpGSnNtxc7NfMGbqenQ== yandex-cloud-vm" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 4. Перезапуск SSH
sudo systemctl restart ssh
```

## 🎯 Рекомендация

**Подождите 2-3 минуты** после перезапуска VM и попробуйте:
1. Войти в серийную консоль снова (попробуйте пустой пароль)
2. Или подключиться через SSH напрямую

