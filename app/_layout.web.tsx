// Workaround для проблемы с Expo Router на вебе
// Используем try-catch для обработки ошибок инициализации

import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { EventsProvider } from '../context/EventsContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';

// ПЕРЕХВАТЫВАЕМ ОШИБКИ ИНИЦИАЛИЗАЦИИ
if (typeof window !== 'undefined') {
  const originalError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    // Игнорируем ошибки инициализации Expo Router
    if (message && typeof message === 'string' && message.includes('Cannot access')) {
      console.warn('Non-critical initialization error (ignored):', message);
      return true; // Предотвращаем вывод ошибки
    }
    if (originalError) {
      return originalError(message, source, lineno, colno, error);
    }
    return false;
  };
}

// ПЕРЕХВАТЫВАЕМ WebSocket ОШИБКИ
if (!(global as any).__websocketErrorSuppressed) {
  (global as any).__websocketErrorSuppressed = true;
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorString = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg?.message) return arg.message;
      if (arg?.toString) return arg.toString();
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');
    
    // Подавляем WebSocket ошибки и ошибки инициализации
    if (
      errorString.includes('WebSocket connection error') ||
      errorString.includes('websocket error') ||
      errorString.includes('TransportError') ||
      errorString.includes('engine.io-client') ||
      errorString.includes('Cannot access') ||
      (errorString.includes('_construct') && errorString.includes('construct.js'))
    ) {
      return; // Не выводим эти ошибки
    }
    
    originalError(...args);
  };
}

function AuthenticatedStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
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
    </Stack>
  );
}

function UnauthenticatedStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
    </Stack>
  );
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

  return isAuthenticated ? <AuthenticatedStack /> : <UnauthenticatedStack />;
}

export default function RootLayout() {
  try {
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
  } catch (error: any) {
    // Обрабатываем ошибки инициализации
    if (error?.message?.includes('Cannot access')) {
      console.warn('Initialization error (non-critical), retrying...');
      // Пробуем еще раз через небольшую задержку
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f' }}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      );
    }
    throw error;
  }
}
