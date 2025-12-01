# 🔍 Диагностика через серийную консоль

## ⚠️ Фундаментальная проблема

SSH не работает, несмотря на открытые порты в Security Groups. **Проблема скорее всего на самой VM**, а не в Security Groups.

## ✅ Решение: Диагностика через серийную консоль

### 1. Откройте серийную консоль

1. [Yandex Cloud Console](https://console.cloud.yandex.ru)
2. Compute Cloud → Виртуальные машины → `event-app-backend`
3. **Серийная консоль** или **Serial Console**
4. Откройте её

### 2. Войдите в систему

Попробуйте:
- Логин: `ubuntu`
- Пароль: просто нажмите Enter (пустой)

Если не работает, попробуйте:
- Логин: `root`
- Пароль: пустой или стандартные варианты

### 3. Выполните диагностику

После входа выполните команды **по порядку**:

```bash
# 1. Проверка SSH сервиса
sudo systemctl status ssh
sudo systemctl status sshd

# 2. Если SSH не запущен - запустите
sudo systemctl start ssh
sudo systemctl enable ssh

# 3. Проверка firewall
sudo ufw status

# 4. Открытие порта 22 в firewall (если закрыт)
sudo ufw allow 22/tcp
sudo ufw allow 4000/tcp
sudo ufw allow 8081/tcp

# 5. Проверка SSH ключа
ls -la ~/.ssh/
cat ~/.ssh/authorized_keys

# 6. Если ключа нет - добавьте вручную
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDZewwNpteyUcXGqzc2BuE8E8gCXDVr5VzAetcnV8jFIbBAbLxshM6qoZy9t+F3BDRTlT1PSRSI5DIocFNlezdgEUNSkY2kUCcRnosioTi02YyjK/6atC83oDadf2qbxr0k5Owwv08Emc5FvE2n+qDErW4jCAslYQd8bp37zoSnVeFZtjNIU0+IodIHHYEBFYlnUTGokKBbPbYm3T5mcrCj6oYtBCOT42z6C4t2Rx0u4vqhzmv+r2DzZlbk9DTTXBw8dhoy0IaDo5bR4NDcrQQRkf8AyqXbPvwmK68a73/nFUaAzpYm/iuDO4FxcgjKHBqM+zFuzUE7+tToTdlMIXJ0mcnUUtLgxvLFGPCVYZq6NSi2Cx96r9xqSXJw2xn2cQRB0G2pUWyWsxkmY98C8rpryd3qYvNUoeEBxu1JJy23P1hf42MIBYsTj3O2MtHQvvD8V6bt5kjt4y6eVaXUVHPh7Uj7OWWTLlHZM7lXTILG3J7udK+X+2vOodEQrI7L0/BPee9hZj4By8mr937Rj7gt0hRo+JWF9dRptDJdecgZxpxIsRtAt6xn9YoWFHkkO/l0dq4yX0e9ea9J8p/RljDukTbmYPCoCs57f0kAqA2vmIKkyJPFIJWMI81SGquVm6TNQ79rAD0SNkh/w48sNVAowFQwpGSnNtxc7NfMGbqenQ== yandex-cloud-vm" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 7. Проверка сетевых интерфейсов
ip addr show
netstat -tlnp | grep :22

# 8. Проверка логов SSH
sudo tail -20 /var/log/auth.log
sudo journalctl -u ssh -n 20

# 9. Перезапуск SSH
sudo systemctl restart ssh
```

### 4. После исправления

Попробуйте SSH снова:

```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@84.201.179.62
```

## 🎯 Наиболее вероятные причины

1. **SSH сервис не запущен** - самая вероятная причина
2. **Firewall на VM блокирует порт 22** - даже если Security Group открыта
3. **SSH ключ не применен** - cloud-init не сработал

## ✅ После исправления SSH

Запустите приложение:

```bash
cd ~/event_app_new/server
pm2 start dist/src/main.js --name event-app
pm2 save
pm2 status
curl http://localhost:4000/health
```

## 📝 Резюме

**Проблема не в Security Groups** - они настроены правильно. Проблема **на самой VM**:
- SSH сервис не запущен, ИЛИ
- Firewall блокирует, ИЛИ  
- SSH ключ не применен

**Используйте серийную консоль для диагностики и исправления!**

