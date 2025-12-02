# ✅ VM пересоздана с правильным SSH ключом

## Новая информация

VM была пересоздана с правильным SSH ключом через метаданные.

### Подключение через веб-консоль

1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru/folders/b1ghu2t9vbuibrafe9ck/compute/instances)
2. Найдите VM `event-app-backend`
3. Нажмите "Подключиться" → "SSH"

### Данные для подключения

**Логин:** `ubuntu`

**Закрытый SSH-ключ:** 
Скопируйте весь текст из файла `~/.ssh/yandex-cloud` (приватный ключ)

Или используйте команду на вашем компьютере:
```bash
cat ~/.ssh/yandex-cloud
```

### После подключения

Выполните в терминале VM:

```bash
# Проверка
hostname
whoami

# Добавить SSH ключ для будущих подключений
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDZewwNpteyUcXGqzc2BuE8E8gCXDVr5VzAetcnV8jFIbBAbLxshM6qoZy9t+F3BDRTlT1PSRSI5DIocFNlezdgEUNSkY2kUCcRnosioTi02YyjK/6atC83oDadf2qbxr0k5Owwv08Emc5FvE2n+qDErW4jCAslYQd8bp37zoSnVeFZtjNIU0+IodIHHYEBFYlnUTGokKBbPbYm3T5mcrCj6oYtBCOT42z6C4t2Rx0u4vqhzmv+r2DzZlbk9DTTXBw8dhoy0IaDo5bR4NDcrQQRkf8AyqXbPvwmK68a73/nFUaAzpYm/iuDO4FxcgjKHBqM+zFuzUE7+tToTdlMIXJ0mcnUUtLgxvLFGPCVYZq6NSi2Cx96r9xqSXJw2xn2cQRB0G2pUWyWsxkmY98C8rpryd3qYvNUoeEBxu1JJy23P1hf42MIBYsTj3O2MtHQvvD8V6bt5kjt4y6eVaXUVHPh7Uj7OWWTLlHZM7lXTILG3J7udK+X+2vOodEQrI7L0/BPee9hZj4By8mr937Rj7gt0hRo+JWF9dRptDJdecgZxpxIsRtAt6xn9YoWFHkkO/l0dq4yX0e9ea9J8p/RljDukTbmYPCoCs57f0kAqA2vmIKkyJPFIJWMI81SGquVm6TNQ79rAD0SNkh/w48sNVAowFQwpGSnNtxc7NfMGbqenQ== yandex-cloud-vm" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

После этого можно будет подключаться по SSH с вашего компьютера.

