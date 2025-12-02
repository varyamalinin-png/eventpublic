# Как посмотреть логи приложения

## 1. Логи клиентского приложения (React Native/Expo)

### В терминале (во время разработки):
```bash
cd /Users/varya.malinina.2003mail.ru/event_app_new/client

# Запустить Metro bundler с логами
npx expo start

# Или для iOS
npx expo start --ios

# Или для Android
npx expo start --android
```

### Логи iOS устройства (если приложение уже установлено):
```bash
# Через Xcode Console (лучший способ)
# Откройте Xcode → Window → Devices and Simulators → выберите устройство → View Device Logs

# Или через терминал (требует подключенное устройство)
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "eventappnew"' --level debug

# Или для физического устройства через Console.app
# Откройте Console.app → выберите ваше устройство → фильтр по "eventappnew"
```

### Логи Android устройства:
```bash
# Через adb (требует подключенное устройство)
adb logcat | grep -i "eventapp\|reactnative\|expo"

# Или только ошибки
adb logcat *:E

# Или через React Native CLI
npx react-native log-android
```

## 2. Логи сервера (Yandex Cloud VM)

### Подключиться к серверу и посмотреть логи PM2:
```bash
# Подключиться к серверу
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152

# Посмотреть логи приложения
pm2 logs event-app --lines 100

# Посмотреть только ошибки
pm2 logs event-app --err --lines 100

# Посмотреть логи в реальном времени
pm2 logs event-app --lines 0

# Посмотреть статус приложения
pm2 status

# Посмотреть детальную информацию
pm2 show event-app
```

### Или одной командой из локального терминала:
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "pm2 logs event-app --lines 100"
```

### Логи Nginx (если нужно):
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "tail -f /var/log/nginx/access.log"
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "tail -f /var/log/nginx/error.log"
```

## 3. Логи базы данных (PostgreSQL)

```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "sudo tail -f /var/log/postgresql/postgresql-14-main.log"
```

## 4. Быстрые команды для копирования

### Логи сервера (последние 50 строк):
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "pm2 logs event-app --lines 50 --nostream"
```

### Логи сервера (только ошибки):
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "pm2 logs event-app --err --lines 50 --nostream"
```

### Логи сервера (в реальном времени):
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "pm2 logs event-app --lines 0"
```

### Перезапустить приложение на сервере:
```bash
ssh -i ~/.ssh/yandex-cloud ubuntu@89.169.173.152 "cd ~/event_app_new/server && pm2 restart event-app"
```

## 5. Логи в Xcode (рекомендуется для iOS)

1. Откройте Xcode
2. Подключите iPhone к Mac
3. Откройте Window → Devices and Simulators
4. Выберите ваше устройство
5. Нажмите "View Device Logs"
6. Найдите ваше приложение в списке
7. Фильтруйте по "eventappnew" или "Calendar"

## 6. Проверка изменений в коде

После изменений в клиентском коде нужно:
1. Пересобрать приложение через Xcode
2. Или перезапустить Metro bundler: `npx expo start --clear`

