# 🔍 Глубокий анализ проблемы с SSH (порт 22)

## ⚠️ Проблема

Порт 22 не работает, несмотря на:
- ✅ Правила Security Groups открыты
- ✅ SSH ключ в метаданных
- ✅ OS Login отключен

## 🔍 Возможные причины

### 1. SSH сервис не запущен на VM
- SSH сервер может быть не установлен или не запущен
- Нужно проверить через серийную консоль

### 2. SSH ключ не применен к пользователю ubuntu
- Ключ в метаданных, но не добавлен в ~/.ssh/authorized_keys
- Cloud-init может не применить ключ

### 3. Firewall на VM блокирует порт 22
- ufw может блокировать порт, даже если Security Group открыта
- Нужно проверить ufw status

### 4. Правила Security Groups применяются с задержкой
- Может потребоваться до 5-10 минут
- Нужно подождать

### 5. Проблема с сетевой конфигурацией
- NAT может быть не настроен правильно
- Подсеть может иметь ограничения

## ✅ Решения

### Решение 1: Проверить через серийную консоль

1. Откройте серийную консоль в веб-консоли
2. Войдите как `ubuntu` (попробуйте пустой пароль)
3. Выполните проверки:

```bash
# Проверка SSH сервиса
sudo systemctl status ssh
sudo systemctl status sshd

# Проверка firewall
sudo ufw status

# Проверка SSH ключа
cat ~/.ssh/authorized_keys

# Запуск SSH если не запущен
sudo systemctl start ssh
sudo systemctl enable ssh

# Открытие порта в firewall
sudo ufw allow 22/tcp
```

### Решение 2: Добавить SSH ключ вручную через серийную консоль

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDZewwNpteyUcXGqzc2BuE8E8gCXDVr5VzAetcnV8jFIbBAbLxshM6qoZy9t+F3BDRTlT1PSRSI5DIocFNlezdgEUNSkY2kUCcRnosioTi02YyjK/6atC83oDadf2qbxr0k5Owwv08Emc5FvE2n+qDErW4jCAslYQd8bp37zoSnVeFZtjNIU0+IodIHHYEBFYlnUTGokKBbPbYm3T5mcrCj6oYtBCOT42z6C4t2Rx0u4vqhzmv+r2DzZlbk9DTTXBw8dhoy0IaDo5bR4NDcrQQRkf8AyqXbPvwmK68a73/nFUaAzpYm/iuDO4FxcgjKHBqM+zFuzUE7+tToTdlMIXJ0mcnUUtLgxvLFGPCVYZq6NSi2Cx96r9xqSXJw2xn2cQRB0G2pUWyWsxkmY98C8rpryd3qYvNUoeEBxu1JJy23P1hf42MIBYsTj3O2MtHQvvD8V6bt5kjt4y6eVaXUVHPh7Uj7OWWTLlHZM7lXTILG3J7udK+X+2vOodEQrI7L0/BPee9hZj4By8mr937Rj7gt0hRo+JWF9dRptDJdecgZxpxIsRtAt6xn9YoWFHkkO/l0dq4yX0e9ea9J8p/RljDukTbmYPCoCs57f0kAqA2vmIKkyJPFIJWMI81SGquVm6TNQ79rAD0SNkh/w48sNVAowFQwpGSnNtxc7NfMGbqenQ== yandex-cloud-vm" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Решение 3: Перезапустить SSH сервис

```bash
sudo systemctl restart ssh
sudo systemctl restart sshd
```

### Решение 4: Проверить логи SSH

```bash
sudo tail -50 /var/log/auth.log
sudo journalctl -u ssh -n 50
```

## 🎯 Рекомендуемый порядок действий

1. **Откройте серийную консоль**
2. **Войдите как ubuntu** (попробуйте пустой пароль)
3. **Проверьте SSH сервис**: `sudo systemctl status ssh`
4. **Проверьте firewall**: `sudo ufw status`
5. **Добавьте SSH ключ вручную** (если его нет)
6. **Запустите SSH**: `sudo systemctl start ssh`
7. **Откройте порт в firewall**: `sudo ufw allow 22/tcp`
8. **Попробуйте SSH снова**

## 📝 Фундаментальная проблема

Скорее всего проблема в том, что:
- SSH сервис не запущен на VM, ИЛИ
- SSH ключ не применен к пользователю ubuntu, ИЛИ
- Firewall на VM блокирует порт 22

**Нужно проверить через серийную консоль!**

