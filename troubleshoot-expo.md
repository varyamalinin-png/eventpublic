# Решение проблем с подключением Expo

## Если QR-код не открывается в Expo Go:

### 1. Проверьте, что телефон и MacBook в одной Wi-Fi сети
- MacBook IP: 100.114.37.214
- Телефон IP: 100.114.38.85
- Роутер: 100.114.32.1

### 2. Проверьте файрволл на MacBook
```bash
# Проверить статус файрволла
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Если включен, разрешить Node.js
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

### 3. Попробуйте tunnel режим (если LAN не работает)
```bash
cd client
npx expo start --tunnel --port 8081
```

### 4. Проверьте доступность порта с телефона
На телефоне откройте браузер и перейдите:
- http://100.114.37.214:8081

Если страница открывается - порт доступен.

### 5. Введите URL вручную в Expo Go
1. Откройте Expo Go на телефоне
2. Нажмите "Enter URL manually"
3. Введите: `exp://100.114.37.214:8081`

### 6. Альтернатива: используйте tunnel
Если локальная сеть не работает, используйте tunnel (требует интернет):
```bash
npx expo start --tunnel
```

