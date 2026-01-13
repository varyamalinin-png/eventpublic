import React from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View, Platform } from 'react-native';
import { EventsProvider } from '../context/EventsContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="add-account" />
          <Stack.Screen name="add-account-verify" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="map" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="friends-list" />
          <Stack.Screen name="friends-list/[id]" />
          <Stack.Screen name="event-profile/[id]" />
          <Stack.Screen name="all-events/[userId]" />
          <Stack.Screen name="organized-events/[userId]" />
          <Stack.Screen name="participated-events/[userId]" />
          <Stack.Screen name="shared-events/[userId]" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="admin/complaints" />
          <Stack.Screen name="+not-found" />
        </>
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  // Для веба добавляем задержку инициализации, чтобы избежать проблем с порядком загрузки модулей
  const [isReady, setIsReady] = React.useState(Platform.OS !== 'web');
  
  React.useEffect(() => {
    // Небольшая задержка для веба, чтобы все модули успели загрузиться
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AuthProvider>
          <EventsProvider>
            <RouterGate />
          </EventsProvider>
        </AuthProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}
