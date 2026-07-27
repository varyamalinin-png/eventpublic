import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, Dimensions, Image, Platform, Animated } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import { AppIcon } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const logger = createLogger('Map');

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
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { events, isUserEventMember, isEventUpcoming, isEventNotFull, isEventPast, getEventPhotoForUser, getGlobalEvents, getFriendsForEvents, isUserOrganizer, isEventFull, isFriendOfOrganizer, getUserData } = useEvents();
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
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;

  // Получаем события для отображения в зависимости от типа карты
  const eventsToShow = useMemo(() => {
    logger.debug('Calculating eventsToShow:', {
      eventId,
      userId,
      exploreTab,
      totalEvents: events.length,
      eventsWithCoordinates: events.filter(e => e.coordinates).length,
      platform: Platform.OS
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
      // Используем те же признаки для всех событий
      const userEvents = eventsWithCoordinates.filter(event => {
        return isUserEventMember(event, rawUserId);
      });
      logger.debug('User profile map events', { count: userEvents.length });
      return userEvents;
    }

    // 4. КАРТА В МОЕМ ПРОФИЛЕ
    // Показываем все события, где я являюсь членом (будущие и прошедшие)
    // Используем те же признаки для всех событий
    if (!currentUserId) {
      return [];
    }
    const myEvents = eventsWithCoordinates.filter(event => {
      return isUserEventMember(event, currentUserId);
    });
    logger.debug('My profile map events', { count: myEvents.length, events: myEvents.map(e => ({ id: e.id, title: e.title, hasCoordinates: !!e.coordinates })) });
    return myEvents;
  }, [eventId, events, rawUserId, exploreTab, isUserEventMember, isEventUpcoming, isEventPast, getGlobalEvents, getFriendsForEvents, currentUserId]);

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

  const handleMarkerPress = useCallback((markerEventId: string) => {
    const event = eventsToShow.find(e => e.id === markerEventId);
    if (!event) return;

    setSelectedEvent(event);
    Animated.spring(bottomSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [eventsToShow, bottomSheetAnim]);

  const handleBottomSheetNavigate = useCallback(() => {
    if (!selectedEvent) return;
    const now = Date.now();

    if (!navigationRef.current.isNavigating ||
        navigationRef.current.lastEventId !== selectedEvent.id ||
        now - navigationRef.current.lastNavigateTime > 500) {

      navigationRef.current.isNavigating = true;
      navigationRef.current.lastEventId = selectedEvent.id;
      navigationRef.current.lastNavigateTime = now;

      router.push(`/event-profile/${selectedEvent.id}`);

      setTimeout(() => {
        navigationRef.current.isNavigating = false;
      }, 1000);
    }
  }, [selectedEvent, router]);

  const dismissBottomSheet = useCallback(() => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedEvent(null));
  }, [bottomSheetAnim]);

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
      <View style={[styles.backButtonOverlay, { top: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← {t.common.back}</Text>
        </TouchableOpacity>
      </View>

      {/* Наименование карты с отдельной оверлейной рамкой */}
      <View style={[styles.titleOverlay, { top: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>
          {getMapTitle()}
        </Text>
      </View>

      {/* Карта на весь экран без отступов */}
      <View style={styles.mapContainer}>
        {mapError ? (
          <View style={styles.noEventsContainer}>
            <Text style={styles.noEventsText}>⚠️</Text>
            <Text style={styles.noEventsTitle}>{t.map.loadError}</Text>
            <Text style={styles.noEventsSubtitle}>{mapError}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setMapError(null);
                setMapReady(false);
              }}
            >
              <Text style={styles.retryButtonText}>{t.common.tryAgain}</Text>
            </TouchableOpacity>
          </View>
        ) : eventsToShow.length === 0 ? (
          <View style={styles.noEventsContainer}>
            <AppIcon name="map" size={28} color={Palette.textFaint} />
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
              setMapReady(true);
              setMapError(null);
            }}
            {...({ onError: (error: any) => {
              const errorMessage = error?.message || String(error) || 'Unknown map error';
              logger.error('Map error:', errorMessage, error);
              setMapError(`Ошибка карты: ${errorMessage}. ${Platform.OS === 'android' ? 'Возможно, нужен Google Maps API ключ.' : ''}`);
            }} as any)}
            onPress={() => {
              if (selectedEvent) dismissBottomSheet();
            }}
            onLayout={() => {
              logger.debug('Map layout calculated');
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
                          <AppIcon name="calendar" size={16} color={Palette.text} />
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

      {/* Bottom sheet event preview */}
      {selectedEvent && (
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{
                translateY: bottomSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0],
                }),
              }],
              opacity: bottomSheetAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.bottomSheetContent}
            onPress={handleBottomSheetNavigate}
            activeOpacity={0.85}
          >
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetRow}>
              {eventPhotosMap[selectedEvent.id] ? (
                <Image
                  source={{ uri: eventPhotosMap[selectedEvent.id] }}
                  style={styles.bottomSheetImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.bottomSheetImage, styles.bottomSheetImagePlaceholder]}>
                  <AppIcon name="calendar" size={24} color={Palette.text} />
                </View>
              )}
              <View style={styles.bottomSheetInfo}>
                <Text style={styles.bottomSheetTitle} numberOfLines={2}>
                  {selectedEvent.title}
                </Text>
                {selectedEvent.location && (
                  <Text style={styles.bottomSheetLocation} numberOfLines={1}>
                    {selectedEvent.location}
                  </Text>
                )}
                <View style={styles.bottomSheetMeta}>
                  <Text style={styles.bottomSheetDate}>
                    {selectedEvent.displayDate || new Date(selectedEvent.startTime).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </Text>
                  {selectedEvent.participants !== undefined && (
                    <Text style={styles.bottomSheetParticipants}>
                      {selectedEvent.participants}/{selectedEvent.maxParticipants}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.bottomSheetButton} onPress={handleBottomSheetNavigate}>
              <Text style={styles.bottomSheetButtonText}>{(t.common as any).open || 'Open'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomSheetDismiss} onPress={dismissBottomSheet}>
            <Text style={styles.bottomSheetDismissText}>{t.common.close}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    elevation: 10, // Для Android
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
  titleOverlay: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '60%',
    elevation: 10, // Для Android
  },
  headerTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#141417', // Фон на случай если карта не загрузится
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141417',
    padding: 20,
  },
  noEventsText: {
    fontSize: 64,
    marginBottom: 20,
  },
  noEventsTitle: {
    color: '#f4f4f5',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noEventsSubtitle: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF8D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#FF8D32',
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
    backgroundColor: '#FF8D32',
  },
  markerPlaceholderText: {
    fontSize: 32,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 40,
    zIndex: 2000,
  },
  bottomSheetContent: {
    backgroundColor: '#1c1c20',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  bottomSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomSheetImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    marginRight: 14,
    backgroundColor: '#FF8D32',
  },
  bottomSheetImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetInfo: {
    flex: 1,
  },
  bottomSheetTitle: {
    color: '#f4f4f5',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  bottomSheetLocation: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 13,
    marginBottom: 4,
  },
  bottomSheetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomSheetDate: {
    color: '#FF8D32',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomSheetParticipants: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 13,
  },
  bottomSheetButton: {
    backgroundColor: '#FF8D32',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  bottomSheetButtonText: {
    color: '#1a0d00',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomSheetDismiss: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  bottomSheetDismissText: {
    color: 'rgba(244,244,245,0.5)',
    fontSize: 14,
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  eventItem: {
    backgroundColor: '#141417',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
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
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  eventItemPrice: {
    color: '#FF8D32',
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
    color: 'rgba(244,244,245,0.55)',
    fontSize: 12,
    marginBottom: 4,
  },
  eventItemTime: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 12,
    marginBottom: 4,
  },
  eventItemCoordinates: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 10,
  },
  eventItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventItemParticipants: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 12,
  },
  routeButton: {
    backgroundColor: '#FF8D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  routeButtonText: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: '600',
  },
});