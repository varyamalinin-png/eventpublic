import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventsProvider } from '../context/EventsContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { ThemeProvider } from '../context/ThemeContext';
import OfflineBanner from '../components/OfflineBanner';
import * as SplashScreen from 'expo-splash-screen';
import { hydrateQueryCache } from '../utils/queryCache';
import { installNavigationGuard } from '../utils/navigationGuard';

// Гасит повторные переходы на один и тот же экран (двойные нажатия).
// Ставится один раз на модуле — патчится singleton router из expo-router.
installNavigationGuard();

// Держим нативный сплэш до конца инициализации авторизации.
// Без этого сплэш прячется на ПЕРВОМ отрисованном кадре — то есть раньше,
// чем прочитан токен из SecureStore, — и пользователь на мгновение видел
// экран входа при каждом запуске, даже будучи авторизованным.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Вызов до маунта на некоторых платформах бросает — это не критично.
});

// Кэш серверных ответов поднимаем в память сразу при старте, пока держится
// сплэш: к моменту, когда человек дойдёт до списка друзей, читать его можно
// будет синхронно, без пустого экрана в ожидании сети.
hydrateQueryCache().catch(() => {
  // Нет кэша — просто загрузимся с сети, как раньше.
});

// Обработка ошибок инициализации Metro и router для всех платформ
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorString = String(args[0] || '');
  // Подавляем ошибки router.use, которые не критичны
  if ((errorString.includes('Cannot read property') && errorString.includes('use')) || 
      (errorString.includes('Cannot access') && errorString.includes('before initialization'))) {
      if (__DEV__) {
      console.warn('[Suppressed router/Metro init error]', ...args);
      }
      return;
    }
    originalError(...args);
  };

// Глобальная обработка ошибок для всех платформ
if (typeof global !== 'undefined') {
  const originalGlobalHandler = global.ErrorUtils?.getGlobalHandler?.();
  if (global.ErrorUtils) {
    global.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const errorMsg = error?.message || String(error);
      // Подавляем ошибки router.use
      if (errorMsg.includes('Cannot read property') && errorMsg.includes('use')) {
        if (__DEV__) {
          console.warn('[Suppressed global router error]', error);
        }
        return;
      }
      // Для всех остальных ошибок используем стандартный обработчик
      if (originalGlobalHandler) {
        originalGlobalHandler(error, isFatal);
      }
    });
  }
}

  // Обработка глобальных ошибок (только для веба)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', (event) => {
      const errorMessage = String(event.message || '');
    if (errorMessage.includes('Cannot read property') && errorMessage.includes('use')) {
        event.preventDefault();
        if (__DEV__) {
        console.warn('[Suppressed global router error]', event);
        }
      }
    }, true);

    // Обработка необработанных промисов
    window.addEventListener('unhandledrejection', (event) => {
      const errorMessage = String(event.reason?.message || event.reason || '');
    if (errorMessage.includes('Cannot read property') && errorMessage.includes('use')) {
        event.preventDefault();
        if (__DEV__) {
        console.warn('[Suppressed unhandled router rejection]', event.reason);
        }
      }
    });
}

function RouterGate() {
  const { isAuthenticated, initializing } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Пуши регистрируем здесь, а не в самом верху дерева: хуку нужны и
  // AuthProvider (токен доступа), и LanguageProvider (язык текста пуша),
  // а RouterGate живёт внутри обоих. Разрешение спрашивается только после
  // входа — см. комментарий в самом хуке.
  usePushNotifications();

  // Раньше при обрыве сессии (выход, истёкший токен) index.tsx уже не
  // перевызывался — он редиректит один раз при первом заходе. RouterGate
  // просто убирал защищённые экраны из стека, поэтому человек оставался на
  // текущем маршруте и видел пустые "Авторизуйтесь"/"Нет событий" вместо
  // формы входа. Здесь ловим именно переход в разлогин и толкаем на /login,
  // если человек всё ещё стоит вне (auth).
  //
  // Гостевой режим: без аккаунта разрешён раздел (tabs) — открыт Explore
  // с заблюренными параметрами, остальные табы перехватывает tabPress-guard
  // в (tabs)/_layout.tsx. Поэтому на /login уводим только с маршрутов
  // вне (tabs) и (auth) (settings и прочие глобальные экраны).
  React.useEffect(() => {
    if (initializing || isAuthenticated) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    if (!inAuthGroup && !inTabsGroup) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, initializing, segments, router]);

  // Сплэш убираем ровно тогда, когда уже известно, авторизован ли человек,
  // — первый видимый кадр сразу правильный. Таймаут страхует от зависания
  // сплэша, если инициализация почему-то не завершится.
  React.useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const safety = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(safety);
  }, [initializing]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0c' }}>
        <ActivityIndicator size="large" color="#FF8D32" />
      </View>
    );
  }

  /**
   * КОРНЕВОЙ стек — только глобальные экраны.
   *
   * После перехода на постабные стеки экраны-детали (профиль пользователя,
   * профиль события, папки, меморис-пост, календарь, карта, списки событий)
   * живут в app/(tabs)/(explore,memories,inbox,profile)/ и здесь их быть не
   * должно. Пока они оставались перечислены тут, роутер ругался
   * «No route named "calendar" exists in nested children» на каждый такой
   * экран — объявления указывали на маршруты, которых в корне уже нет.
   *
   * freezeOnBlur этим экранам тоже больше не нужен: он задан на уровне
   * screenOptions в стеке каждого раздела.
   */
  const authScreens = isAuthenticated
    ? [
        <Stack.Screen key="(tabs)" name="(tabs)" />,
        <Stack.Screen key="(auth)" name="(auth)" />,
        <Stack.Screen key="settings" name="settings" />,
        <Stack.Screen key="add-account" name="add-account" />,
        <Stack.Screen key="add-account-verify" name="add-account-verify" />,
        // Экраны с незавершённым вводом — без freezeOnBlur, чтобы не терять черновик.
        <Stack.Screen key="create-event" name="create-event" />,
        <Stack.Screen key="select-location" name="select-location" />,
        <Stack.Screen key="my-events" name="my-events" options={{ freezeOnBlur: true }} />,
        <Stack.Screen key="my-complaints" name="my-complaints" options={{ freezeOnBlur: true }} />,
        <Stack.Screen key="support/complaints" name="support/complaints" options={{ freezeOnBlur: true }} />,
        <Stack.Screen key="admin/index" name="admin/index" options={{ freezeOnBlur: true }} />,
        <Stack.Screen key="admin/complaints" name="admin/complaints" options={{ freezeOnBlur: true }} />,
        <Stack.Screen key="admin/mail" name="admin/mail" options={{ freezeOnBlur: true }} />,
        <Stack.Screen key="+not-found" name="+not-found" />,
      ]
    : [
        // Гостю нужен раздел (tabs) — Explore открыт без аккаунта,
        // плюс (auth) для экрана входа/регистрации.
        <Stack.Screen key="(tabs)" name="(tabs)" />,
        <Stack.Screen key="(auth)" name="(auth)" />,
        <Stack.Screen key="+not-found" name="+not-found" />,
      ];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        /**
         * Зона свайпа-назад.
         *
         * Здесь стояло `{ start: 50 }` — то есть ровно значение по умолчанию:
         * комментарий обещал расширение, а на деле оставалась та же полоска у
         * самой рамки.
         *
         * 120 точек: жест можно начать заметно дальше от края, но не с середины
         * экрана — иначе он начнёт спорить с горизонтальными жестами внутри
         * экранов (свайп карточки события, карусели фотографий).
         */
        gestureResponseDistance: { start: 120 },
      }}
    >
      <Stack.Screen name="index" />
      {authScreens}
    </Stack>
  );
}

export default function RootLayout() {
  // Для веба добавляем задержку инициализации, чтобы избежать проблем с порядком загрузки модулей
  const [isReady, setIsReady] = React.useState(false);
  
  React.useEffect(() => {
    // Небольшая задержка для веба, чтобы все модули успели загрузиться
    if (typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsReady(true);
    }
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0c' }}>
        <ActivityIndicator size="large" color="#FF8D32" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0a0c' }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
        <ThemeProvider>
        <LanguageProvider>
          {/* Баннер переведён, поэтому ему нужен LanguageProvider. Он по-прежнему
              выше Auth и Events — при сбое авторизации или данных всё равно виден */}
          <OfflineBanner />
          <AuthProvider>
            <EventsProvider>
              <View style={Platform.OS === 'web' ? {
                flex: 1,
                width: '100%',
                backgroundColor: '#0a0a0c',
              } : {
                flex: 1,
                maxWidth: 500,
                width: '100%',
                alignSelf: 'center',
                backgroundColor: '#0a0a0c',
              }}>
                <RouterGate />
              </View>
            </EventsProvider>
          </AuthProvider>
        </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
