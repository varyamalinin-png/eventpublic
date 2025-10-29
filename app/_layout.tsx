import { Stack } from 'expo-router';
import { EventsProvider } from '../context/EventsContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <EventsProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="calendar" options={{ headerShown: false }} />
          <Stack.Screen name="map" options={{ headerShown: false }} />
          <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="event-detail/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="friends-list" options={{ headerShown: false }} />
          <Stack.Screen name="friends-list/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="event-profile/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </EventsProvider>
    </GestureHandlerRootView>
  );
}
