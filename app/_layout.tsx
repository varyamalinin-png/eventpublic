import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { EventsProvider } from '../context/EventsContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';

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
      <Stack.Screen name="event/[id]" />
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
