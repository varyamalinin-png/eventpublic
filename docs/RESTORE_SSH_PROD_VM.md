# Восстановление SSH-доступа к прод VM (158.160.67.4)

Если при деплое или `ssh-copy-id` появляется **Permission denied (publickey)** на хосте **158.160.67.4** (iventapp.ru), на VM не принимается ваш ключ `~/.ssh/yandex-cloud`. Добавить ключ можно только через консоль Yandex Cloud.

## Способ 1: Серийная консоль (Serial Console)

1. Откройте [Yandex Cloud Console](https://console.cloud.yandex.ru/) → Compute Cloud → Виртуальные машины.
2. Выберите VM с адресом 158.160.67.4 (или имя типа `event-app-*` для прода).
3. Нажмите **Подключиться** → **Серийная консоль** (или **Serial console**).
4. Войдите под пользователем, у которого есть sudo (часто `ubuntu` или как в метаданных VM).
5. Выполните на VM:
   ```bash
   mkdir -p ~/.ssh
   chmod 700 ~/.ssh
   echo "ВСТАВЬТЕ_СЮДА_СОДЕРЖИМОЕ_ФАЙЛА_yandex-cloud.pub" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
   Содержимое файла на вашем Mac:
   ```bash
   cat ~/.ssh/yandex-cloud.pub
   ```
   Скопируйте одну строку (начинается с `ssh-rsa` или `ssh-ed25519`) и вставьте вместо `ВСТАВЬТЕ_СЮДА_...`.

## Способ 2: Метаданные VM (при перезапуске)

В Yandex Cloud можно задать SSH-ключи через метаданные VM:

1. Compute Cloud → ВМ → выберите инстанс → **Изменить**.
2. Секция **Дополнительно** / **Метаданные**.
3. Ключ: `ssh-keys`, значение:
   ```
   ubuntu:ssh-rsa AAAAB3...ваш_публичный_ключ... user@host
   ```
   (одна строка из `~/.ssh/yandex-cloud.pub`, с префиксом `ubuntu:`).
4. Сохранить и перезапустить VM (метаданные применяются при старте).

## После восстановления доступа

Проверка:
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@158.160.67.4 "echo OK"
```

Деплой на прод:
```bash
VM_HOST=158.160.67.4 ./scripts/deploy-nextjs-to-vm.sh
```
