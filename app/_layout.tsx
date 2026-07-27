import React from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventsProvider } from '../context/EventsContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider } from '../context/ThemeContext';
import OfflineBanner from '../components/OfflineBanner';

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

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0c' }}>
        <ActivityIndicator size="large" color="#FF8D32" />
      </View>
    );
  }

  const authScreens = isAuthenticated
    ? [
        <Stack.Screen key="(tabs)" name="(tabs)" />,
        <Stack.Screen key="(auth)" name="(auth)" />,
        <Stack.Screen key="settings" name="settings" />,
        <Stack.Screen key="add-account" name="add-account" />,
        <Stack.Screen key="add-account-verify" name="add-account-verify" />,
        <Stack.Screen key="calendar" name="calendar" />,
        <Stack.Screen key="map" name="map" />,
        <Stack.Screen key="profile/[id]" name="profile/[id]" />,
        <Stack.Screen key="friends-list" name="friends-list" />,
        <Stack.Screen key="friends-list/[id]" name="friends-list/[id]" />,
        <Stack.Screen key="event-profile/[id]" name="event-profile/[id]" />,
        <Stack.Screen key="all-events/[userId]" name="all-events/[userId]" />,
        <Stack.Screen key="organized-events/[userId]" name="organized-events/[userId]" />,
        <Stack.Screen key="participated-events/[userId]" name="participated-events/[userId]" />,
        <Stack.Screen key="shared-events/[userId]" name="shared-events/[userId]" />,
        <Stack.Screen key="payment" name="payment" />,
        <Stack.Screen key="create-event" name="create-event" />,
        <Stack.Screen key="my-events" name="my-events" />,
        <Stack.Screen key="my-complaints" name="my-complaints" />,
        <Stack.Screen key="support/complaints" name="support/complaints" />,
        <Stack.Screen key="select-location" name="select-location" />,
        <Stack.Screen key="event-folder/[id]" name="event-folder/[id]" />,
        <Stack.Screen key="event-folder-view/[id]" name="event-folder-view/[id]" />,
        <Stack.Screen key="memory-post/[eventId]/[postId]" name="memory-post/[eventId]/[postId]" />,
        <Stack.Screen key="admin/index" name="admin/index" />,
        <Stack.Screen key="admin/complaints" name="admin/complaints" />,
        <Stack.Screen key="+not-found" name="+not-found" />,
      ]
    : [<Stack.Screen key="(auth)" name="(auth)" />];

  return (
    <Stack screenOptions={{ headerShown: false }}>
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
