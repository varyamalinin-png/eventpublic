# 🔧 Проблема с SSH подключением

## Текущая ситуация

VM создана:
- **IP**: 84.201.164.3
- **Статус**: RUNNING
- **Проблема**: SSH ключ не применяется

## Решение

### Вариант 1: Через консоль Yandex Cloud (рекомендуется)

1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru)
2. Перейдите в Compute Cloud → Виртуальные машины
3. Найдите `event-app-backend`
4. Нажмите "Подключиться" → "SSH"
5. Откроется веб-консоль, где можно работать

### Вариант 2: Добавить SSH ключ через консоль

В веб-консоли выполните:

```bash
# Добавить ваш публичный ключ
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDZewwNpteyUcXGqzc2BuE8E8gCXDVr5VzAetcnV8jFIbBAbLxshM6qoZy9t+F3BDRTlT1PSRSI5DIocFNlezdgEUNSkY2kUCcRnosioTi02YyjK/6atC83oDadf2qbxr0k5Owwv08Emc5FvE2n+qDErW4jCAslYQd8bp37zoSnVeFZtjNIU0+IodIHHYEBFYlnUTGokKBbPbYm3T5mcrCj6oYtBCOT42z6C4t2Rx0u4vqhzmv+r2DzZlbk9DTTXBw8dhoy0IaDo5bR4NDcrQQRkf8AyqXbPvwmK68a73/nFUaAzpYm/iuDO4FxcgjKHBqM+zFuzUE7+tToTdlMIXJ0mcnUUtLgxvLFGPCVYZq6NSi2Cx96r9xqSXJw2xn2cQRB0G2pUWyWsxkmY98C8rpryd3qYvNUoeEBxu1JJy23P1hf42MIBYsTj3O2MtHQvvD8V6bt5kjt4y6eVaXUVHPh7Uj7OWWTLlHZM7lXTILG3J7udK+X+2vOodEQrI7L0/BPee9hZj4By8mr937Rj7gt0hRo+JWF9dRptDJdecgZxpxIsRtAt6xn9YoWFHkkO/l0dq4yX0e9ea9J8p/RljDukTbmYPCoCs57f0kAqA2vmIKkyJPFIJWMI81SGquVm6TNQ79rAD0SNkh/w48sNVAowFQwpGSnNtxc7NfMGbqenQ== yandex-cloud-vm" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Вариант 3: Пересоздать VM через веб-интерфейс

1. Удалите текущую VM
2. Создайте новую через веб-интерфейс
3. При создании укажите SSH ключ в разделе "Доступ"

## Текущая информация

- **VM ID**: epdoc56qcs4iq6894jql
- **IP**: 84.201.164.3
- **Зона**: ru-central1-b

