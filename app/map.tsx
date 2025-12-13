<<<<<<< HEAD
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, Dimensions, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';

const logger = createLogger('Map');

const { width, height } = Dimensions.get('window');

// Темная тема для карты
const darkMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#242f3e" }]
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#242f3e" }]
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#746855" }]
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }]
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }]
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }]
  }
];

export default function MapScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { events, eventProfiles, isUserEventMember, isEventUpcoming, isEventNotFull, isEventPast, getEventPhotoForUser, getGlobalEvents, getFriendsForEvents, isUserOrganizer, isEventFull, isFriendOfOrganizer, getUserData } = useEvents();
  const { eventId, selectLocation, userId, exploreTab } = useLocalSearchParams();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const mapRef = useRef<MapView>(null);
  const navigationRef = useRef<{ isNavigating: boolean; lastEventId: string | null; lastNavigateTime: number }>({
    isNavigating: false,
    lastEventId: null,
    lastNavigateTime: 0
  });
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const rawUserId = Array.isArray(userId) ? userId[0] : typeof userId === 'string' ? userId : undefined;

  // Получаем события для отображения в зависимости от типа карты
  const eventsToShow = useMemo(() => {
    logger.debug('Calculating eventsToShow:', {
      eventId,
      userId,
      exploreTab,
      totalEvents: events.length,
      eventsWithCoordinates: events.filter(e => e.coordinates).length
    });
    
    if (eventId) {
      const filtered = events.filter(event => event.id === eventId);
      logger.debug('Single event mode', { count: filtered.length, eventId });
      return filtered;
    }

    const eventsWithCoordinates = events.filter(event => event.coordinates);
    logger.debug('Events with coordinates', { count: eventsWithCoordinates.length });

    // 1. КАРТА ГЛОБ (из ленты GLOB в explore)
    if (exploreTab === 'GLOB') {
      const globEvents = getGlobalEvents().filter(event => event.coordinates);
      logger.debug('GLOB map events', { count: globEvents.length, events: globEvents.map(e => ({ id: e.id, title: e.title, hasCoordinates: !!e.coordinates })) });
      return globEvents;
    }

    // 2. КАРТА FRIENDS (из ленты FRIENDS в explore)
    if (exploreTab === 'FRIENDS') {
      const friendsEvents = getFriendsForEvents().filter(event => event.coordinates);
      logger.debug('FRIENDS map events', { count: friendsEvents.length });
      return friendsEvents;
    }

    // 3. КАРТА В ЧУЖОМ ПРОФИЛЕ
    if (rawUserId && (!currentUserId || rawUserId !== currentUserId)) {
      // Показываем все события, где этот пользователь является членом (будущие и прошедшие)
      // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем через eventProfiles, чтобы учесть удаление
      const userEvents = eventsWithCoordinates.filter(event => {
        // Для текущих событий - проверяем обычным способом
        if (isEventUpcoming(event)) {
          return isUserEventMember(event, rawUserId);
        }
        
        // Для прошедших событий - проверяем через профиль
        if (isEventPast(event)) {
          const profile = eventProfiles.find(p => p.eventId === event.id);
          if (profile) {
            // Проверяем, есть ли пользователь в participants
            return profile.participants.includes(rawUserId);
          }
          // Если профиля нет - не показываем (пользователь был удален)
          return false;
        }
        
        return isUserEventMember(event, rawUserId);
      });
      logger.debug('User profile map events', { count: userEvents.length });
      return userEvents;
    }

    // 4. КАРТА В МОЕМ ПРОФИЛЕ
    // Показываем все события, где я являюсь членом (будущие и прошедшие)
    // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем через eventProfiles, чтобы учесть удаление
    if (!currentUserId) {
      return [];
    }
    const myEvents = eventsWithCoordinates.filter(event => {
      // Для текущих событий - проверяем обычным способом
      if (isEventUpcoming(event)) {
        return isUserEventMember(event, currentUserId);
      }
      
      // Для прошедших событий - проверяем через профиль
      if (isEventPast(event)) {
        const profile = eventProfiles.find(p => p.eventId === event.id);
        if (profile) {
          // Проверяем, есть ли пользователь в participants
          return profile.participants.includes(currentUserId);
        }
        // Если профиля нет - не показываем (пользователь был удален)
        return false;
      }
      
      return isUserEventMember(event, currentUserId);
    });
    logger.debug('My profile map events', { count: myEvents.length, events: myEvents.map(e => ({ id: e.id, title: e.title, hasCoordinates: !!e.coordinates })) });
    return myEvents;
  }, [eventId, events, eventProfiles, rawUserId, exploreTab, isUserEventMember, isEventUpcoming, isEventPast, getGlobalEvents, getFriendsForEvents, currentUserId]);

  // Вычисляем фото для всех событий - теперь используем Image из React Native, который работает с file://
  const eventPhotosMap = useMemo(() => {
    const photos: Record<string, string> = {};
    eventsToShow.forEach(event => {
      // Точно так же, как в календаре для текущего пользователя
      const photoUrl = getEventPhotoForUser(event.id, currentUserId ?? '', undefined);
      if (photoUrl) {
        photos[event.id] = photoUrl;
      }
    });
    return photos;
  }, [eventsToShow, currentUserId, getEventPhotoForUser]);


  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Вычисляем центр карты и регион
  const mapRegion = useMemo(() => {
    if (eventsToShow.length === 0) {
      return {
        latitude: 55.7558,
        longitude: 37.6176,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    
    if (eventId && eventsToShow.length === 1) {
      const event = eventsToShow[0];
      return {
        latitude: event.coordinates?.latitude || 55.7558,
        longitude: event.coordinates?.longitude || 37.6176,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    
    // Вычисляем центр для всех событий
    const lats = eventsToShow.map(e => e.coordinates?.latitude).filter(Boolean) as number[];
    const lngs = eventsToShow.map(e => e.coordinates?.longitude).filter(Boolean) as number[];
    
    if (lats.length === 0) {
      return {
        latitude: 55.7558,
        longitude: 37.6176,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.1),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.1),
    };
  }, [eventsToShow, eventId]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Разрешение на доступ к местоположению не предоставлено');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    } catch (error) {
      logger.error('Ошибка получения местоположения:', error);
    }
  };

  const handleMarkerPress = useCallback((eventId: string) => {
    const now = Date.now();
    
    if (eventId && 
        (!navigationRef.current.isNavigating || 
         navigationRef.current.lastEventId !== eventId ||
         now - navigationRef.current.lastNavigateTime > 500)) {
      
      navigationRef.current.isNavigating = true;
      navigationRef.current.lastEventId = eventId;
      navigationRef.current.lastNavigateTime = now;
      
      router.push(`/event-profile/${eventId}`);
      
      setTimeout(() => {
        navigationRef.current.isNavigating = false;
      }, 1000);
    }
  }, [router]);

  // Определяем заголовок карты в зависимости от контекста
  const getMapTitle = () => {
    if (selectLocation) {
      return t.map.selectLocation || 'Select location';
    }
    if (eventId) {
      return t.map.eventLocation || 'Event location';
    }
    if (exploreTab === 'GLOB') {
      return t.map.allEventsMap || 'All events map';
    }
    if (exploreTab === 'FRIENDS') {
      return t.map.friendsEventsMap || 'Friends events map';
    }
    if (rawUserId && (!currentUserId || rawUserId !== currentUserId)) {
      const user = getUserData(rawUserId);
      const username = user?.username || user?.name || 'User';
      return `${username} ${t.map.eventsMap || 'events map'}`;
    }
    if (currentUserId) {
      return t.map.myEventsMap || 'My events map';
    }
    return t.map.eventsMap || 'Events map';
  };

  return (
    <View style={styles.container}>
      {/* Кнопка назад с отдельной оверлейной рамкой */}
      <View style={styles.backButtonOverlay}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← {t.common.back}</Text>
        </TouchableOpacity>
      </View>
      
      {/* Наименование карты с отдельной оверлейной рамкой */}
      <View style={styles.titleOverlay}>
        <Text style={styles.headerTitle}>
          {getMapTitle()}
        </Text>
      </View>

      {/* Карта на весь экран без отступов */}
      <View style={styles.mapContainer}>
        {eventsToShow.length === 0 ? (
          <View style={styles.noEventsContainer}>
            <Text style={styles.noEventsText}>🗺️</Text>
            <Text style={styles.noEventsTitle}>{t.map.noEventsFound || 'Events not found'}</Text>
            <Text style={styles.noEventsSubtitle}>{t.map.noEventsWithCoordinates || 'No events with coordinates to display on the map'}</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            region={mapRegion}
            showsUserLocation={true}
            showsMyLocationButton={false}
            mapType="standard"
            customMapStyle={darkMapStyle}
            userInterfaceStyle="dark"
            onMapReady={() => {
              logger.debug('Map is ready');
            }}
            onError={(error) => {
              logger.error('Map error:', error);
            }}
          >
            {eventsToShow.map((event) => {
              const lat = event.coordinates?.latitude;
              const lng = event.coordinates?.longitude;
              if (!lat || !lng) return null;
              
              const photoUrl = eventPhotosMap[event.id];
              const isPast = isEventPast(event);
              
              return (
                <Marker
                  key={event.id}
                  coordinate={{ latitude: lat, longitude: lng }}
                  onPress={() => handleMarkerPress(event.id)}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.markerCircle, isPast && styles.markerCirclePast]}>
                      {photoUrl ? (
                        <Image 
                          source={{ uri: photoUrl }} 
                          style={styles.markerImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.markerPlaceholder}>
                          <Text style={styles.markerPlaceholderText}>📅</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Marker>
              );
            })}
          </MapView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  titleOverlay: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '60%',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  noEventsText: {
    fontSize: 64,
    marginBottom: 20,
  },
  noEventsTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noEventsSubtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#8B5CF6',
  },
  markerCirclePast: {
    opacity: 0.65, // Затемнение для прошедших событий
  },
  markerImage: {
    width: '100%',
    height: '100%',
  },
  markerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
  },
  markerPlaceholderText: {
    fontSize: 32,
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  eventItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  eventItemContent: {
    padding: 15,
  },
  eventItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventItemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  eventItemPrice: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  eventItemDescription: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  eventItemDetails: {
    marginBottom: 12,
  },
  eventItemLocation: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  eventItemTime: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  eventItemCoordinates: {
    color: '#666',
    fontSize: 10,
  },
  eventItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventItemParticipants: {
    color: '#999',
    fontSize: 12,
  },
  routeButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  routeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
=======
// Базовый файл для Expo Router
// Для веба используем map.web.tsx, для нативных платформ - map.native.tsx
// Expo Router автоматически выберет правильную версию через платформенные расширения

// Просто реэкспортируем веб-версию
// Для веба это будет использоваться
// Для нативных платформ Expo Router выберет map.native.tsx автоматически
export { default } from './map.web';
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
