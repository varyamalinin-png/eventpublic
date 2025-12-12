# Как пересобрать проект после изменений

## Когда нужно пересобирать

После изменений в коде, которые затрагивают:
- Нативные модули (react-native-maps, expo-location и т.д.)
- Конфигурацию приложения (app.json, AndroidManifest.xml, Info.plist)
- Зависимости (package.json)

## Для iOS (Xcode)

1. **Очистка кэша:**
```bash
cd client
rm -rf ios/Pods
rm -rf ios/build
rm Podfile.lock
```

2. **Переустановка зависимостей:**
```bash
cd ios
pod install
cd ..
```

3. **Пересборка в Xcode:**
   - Откройте `client/ios/eventappnew.xcworkspace` в Xcode
   - Product → Clean Build Folder (Shift + Cmd + K)
   - Product → Build (Cmd + B)
   - Запустите на устройстве/симуляторе

4. **Или через терминал:**
```bash
cd client
npx expo run:ios
```

## Для Android

1. **Очистка:**
```bash
cd client/android
./gradlew clean
cd ..
```

2. **Пересборка:**
```bash
cd client
npx expo run:android
```

## Быстрая пересборка (если изменения только в JS/TS коде)

Если вы изменили только JavaScript/TypeScript код (не нативные модули), можно просто:
```bash
cd client
npx expo start --clear
```

Затем в приложении встряхните устройство и выберите "Reload".

## После изменений в карте

Если карта не работает в нативном билде, но работает в Expo:
1. Убедитесь, что `react-native-maps` установлен: `npm install react-native-maps`
2. Пересоберите проект (см. инструкции выше)
3. Для Android может потребоваться Google Maps API ключ в `AndroidManifest.xml`

