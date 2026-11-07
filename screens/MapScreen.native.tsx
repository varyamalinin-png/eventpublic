import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, Dimensions, Image, Platform, Animated } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import EventFiltersPanel from '../components/EventFiltersPanel';
import { countActiveFilters, matchesFilters, getTagLabels, type FilterOptions } from '../utils/eventSearchFilters';
import { AppIcon } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sizedImage } from '../utils/imageSize';

const logger = createLogger('Map');

type EventMarkerProps = {
  eventId: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
  isPast: boolean;
  /** Проходит ли событие текущие фильтры. Скрытая метка ОСТАЁТСЯ на карте. */
  visible: boolean;
  onPress: (eventId: string) => void;
};

/**
 * Метка события — ОТДЕЛЬНЫЙ мемоизированный компонент, и это принципиально.
 *
 * react-native-maps на каждую перестройку списка детей карты дёргает у
 * нативного MKMapView insertReactSubview/removeReactSubview. Если в этот же
 * кадр вью успело быть уничтожено, RN передаёт туда nil, и приложение падает
 * внутри библиотеки — AIRMap.m:139, `insertObject:nil`
 * (NSInvalidArgumentException). Именно это и ловилось при фильтрации.
 *
 * Поэтому состояние «картинка загрузилась» (нужное для tracksViewChanges)
 * живёт ВНУТРИ метки. Раньше оно лежало общим словарём в MapScreen: каждая из
 * четырёх десятков картинок своим onLoad перерисовывала весь список детей
 * карты — то есть провоцировала ровно ту перестройку, на которой и падало.
 * Теперь загрузка одной картинки не трогает остальные метки.
 *
 * tracksViewChanges по умолчанию true — react-native-maps перерисовывает
 * метку в растр каждый кадр. Держим его включённым только до загрузки
 * картинки, дальше метка статична.
 *
 * Скрытие через opacity, а НЕ размонтированием — см. комментарий к
 * markerEvents в MapScreen: под новой архитектурой снятие метки с карты и
 * постановка обратно роняют приложение внутри react-native-maps. Метка с
 * нулевой прозрачностью вдобавок не ловит нажатия (UIKit не отдаёт касания
 * вью с alpha ≈ 0), так что скрытая метка ведёт себя как отсутствующая.
 */
const EventMarker = memo(function EventMarker({
  eventId,
  latitude,
  longitude,
  isPast,
  visible,
  onPress,
}: EventMarkerProps) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={() => { if (visible) onPress(eventId); }}
      pinColor={isPast ? '#A87955' : '#FF8D32'}
      opacity={visible ? 1 : 0}
    />
  );
});

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
  const { t, language } = useLanguage();
  const dateLocale = language === 'ru' ? 'ru-RU' : 'en-US';
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
  // Фильтры — те же, что в ленте (общая логика в utils/eventSearchFilters,
  // общая панель в components/EventFiltersPanel). Раньше их на карте не было
  // вовсе: метки показывались все подряд, и сузить выборку было нечем.
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const activeFiltersCount = useMemo(() => countActiveFilters(filters), [filters]);
  const tagLabelsMap = useMemo(() => getTagLabels(t), [t]);

  const baseEventsToShow = useMemo(() => {
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

  // Метки берём из набора ЭТОЙ карты, а не из всех событий подряд: иначе
  // в списке оказываются метки событий без координат или из другого режима
  // карты, и выбор такой метки честно даёт ноль меток на карте.
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    baseEventsToShow.forEach(event => {
      (event?.tags ?? []).forEach((tag: string) => {
        if (tag && typeof tag === 'string') set.add(tag);
      });
    });
    return Array.from(set).sort();
  }, [baseEventsToShow]);

  // Фильтры накладываются ПОВЕРХ уже отобранного набора (глоб/друзья/мои),
  // а не заменяют его: режим карты и фильтры — независимые срезы.
  // Переход по конкретному событию (eventId) фильтры игнорируют — иначе
  // ссылка на событие могла бы открыть пустую карту.
  // Применяем фильтры НЕ на каждое нажатие клавиши.
  //
  // Поля «участники от/до», цена и время — числовые: пока набираешь «150»,
  // фильтр успевал сработать на «1», «15» и «150». Каждый раз это полная
  // перестройка набора меток MKMapView плюс новый region — то есть карту
  // трижды перебрасывало и трижды пересоздавало десятки аннотаций, ещё и
  // одновременно с анимацией клавиатуры. Ждём паузу в наборе.
  const [appliedFilters, setAppliedFilters] = useState<FilterOptions>({});
  useEffect(() => {
    const timer = setTimeout(() => setAppliedFilters(filters), 350);
    return () => clearTimeout(timer);
  }, [filters]);

  const eventsToShow = useMemo(() => {
    if (eventId) return baseEventsToShow;
    return baseEventsToShow.filter(event => matchesFilters(event, appliedFilters, getUserData));
  }, [baseEventsToShow, appliedFilters, eventId, getUserData]);

  // Вычисляем фото для всех событий - теперь используем Image из React Native, который работает с file://
  /**
   * Набор меток на карте НЕ зависит от фильтров — и это лечение конкретного
   * падения, а не оптимизация.
   *
   * react-native-maps 1.20.1 не имеет реализации под новую архитектуру, поэтому
   * работает через слой совместимости RN (RCTLegacyViewManagerInteropComponentView).
   * Fabric переиспользует вью из пула: при размонтировании метки её interop-вью
   * уходит в пул с обнулённым contentView, а при монтировании новой достаётся
   * оттуда же. Если карта успевает вставить такую метку раньше, чем ей вернули
   * contentView, в AIRMap.insertReactSubview прилетает nil — и приложение
   * падает с NSInvalidArgumentException (AIRMap.m:139). Поэтому фильтрация
   * ничего не снимает с карты: метки монтируются один раз, а отфильтрованные
   * просто становятся прозрачными (см. visible у EventMarker).
   *
   * Отсюда же требование не возвращать null из map(): дети карты — только
   * настоящие метки, react-native-maps считает по этому списку индексы вставки.
   */
  const markerEvents = useMemo(
    () => baseEventsToShow.filter(
      event => event.coordinates?.latitude != null && event.coordinates?.longitude != null,
    ),
    [baseEventsToShow],
  );

  const visibleEventIds = useMemo(
    () => new Set(eventsToShow.map(event => event.id)),
    [eventsToShow],
  );

  // По ПОЛНОМУ набору меток, а не по отфильтрованному: скрытые метки остаются
  // на карте (см. markerEvents), и терять у них картинку незачем.
  const eventPhotosMap = useMemo(() => {
    const photos: Record<string, string> = {};
    markerEvents.forEach(event => {
      // Точно так же, как в календаре для текущего пользователя
      const photoUrl = getEventPhotoForUser(event.id, currentUserId ?? '', undefined);
      if (photoUrl) {
        photos[event.id] = photoUrl;
      }
    });
    return photos;
  }, [markerEvents, currentUserId, getEventPhotoForUser]);


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

  // Начальный регион фиксируем один раз — дальше только перелёты.
  const initialRegionRef = useRef(mapRegion);

  // Перелёт к новому кадру делаем ОТДЕЛЬНЫМ шагом, после того как дети карты
  // уже перестроились, и только когда карта готова.
  const lastRegionKeyRef = useRef<string>('');
  useEffect(() => {
    if (!mapReady) return;
    const key = `${mapRegion.latitude.toFixed(5)},${mapRegion.longitude.toFixed(5)},${mapRegion.latitudeDelta.toFixed(5)}`;
    if (key === lastRegionKeyRef.current) return;
    lastRegionKeyRef.current = key;
    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion(mapRegion, 350);
    }, 0);
    return () => clearTimeout(timer);
  }, [mapRegion, mapReady]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.common.error, t.messages.locationPermissionDenied);
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

  // Если выбранное событие отфильтровали, карточка снизу должна закрыться:
  // иначе она продолжает висеть поверх карты и ссылается на метку, которой
  // на карте уже нет.
  useEffect(() => {
    if (!selectedEvent) return;
    if (eventsToShow.some(event => event.id === selectedEvent.id)) return;
    dismissBottomSheet();
  }, [eventsToShow, selectedEvent, dismissBottomSheet]);


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

      {/* Фильтры: кнопка со счётчиком активных и выезжающая панель.
          Кнопка стоит справа ПОД заголовком: справа сверху уже висит
          titleOverlay с zIndex 1000, и на одной высоте он её просто
          перекрывал. */}
      {!eventId && (
        <View style={[styles.filtersButtonOverlay, { top: insets.top + 58 }]}>
          <TouchableOpacity
            style={[styles.filtersButton, activeFiltersCount > 0 && styles.filtersButtonActive]}
            onPress={() => setShowFilters(prev => !prev)}
            activeOpacity={0.8}
          >
            <AppIcon name="filter" size={16} color={activeFiltersCount > 0 ? '#0A0A0A' : Palette.text} />
            {activeFiltersCount > 0 && (
              <Text style={styles.filtersButtonCount}>{activeFiltersCount}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Ноль результатов из-за фильтров — это НЕ повод убирать карту.
          Раньше сюда попадала общая заглушка «нет событий с координатами»,
          которая и врала про причину, и прятала карту вместе с контекстом. */}
      {!eventId && !showFilters && baseEventsToShow.length > 0 && eventsToShow.length === 0 && (
        <View style={[styles.emptyFilterNotice, { top: insets.top + 104 }]} pointerEvents="box-none">
          <Text style={styles.emptyFilterText}>
            {t.map.noEventsForFilters || 'No events match the filters'}
          </Text>
          <TouchableOpacity style={styles.emptyFilterButton} onPress={() => setFilters({})}>
            <Text style={styles.emptyFilterButtonText}>{t.explore.clearFilters || 'Clear'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!eventId && showFilters && (
        <View style={[styles.filtersPanelOverlay, { top: insets.top + 104 }]}>
          <EventFiltersPanel
            filters={filters}
            onChange={setFilters}
            onApply={() => setShowFilters(false)}
            onClear={() => setFilters({})}
            availableTags={availableTags}
            tagLabels={tagLabelsMap}
            // На карте только события с координатами, то есть офлайновые —
            // выбирать между онлайном и офлайном здесь нечего.
            showPlaceFilter={false}
          />
        </View>
      )}

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
        ) : baseEventsToShow.length === 0 ? (
          <View style={styles.noEventsContainer}>
            <AppIcon name="map" size={28} color={Palette.textFaint} />
            <Text style={styles.noEventsTitle}>{t.map.noEventsFound || 'Events not found'}</Text>
            <Text style={styles.noEventsSubtitle}>{t.map.noEventsWithCoordinates || 'No events with coordinates to display on the map'}</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            // Регион НЕ управляемый пропом: раньше здесь стоял region={mapRegion},
            // и любой рендер, меняющий набор меток (фильтр!), в том же кадре
            // отдавал MKMapView ещё и новый регион. Анимация региона
            // одновременно с добавлением/удалением аннотаций — как раз тот
            // случай, на котором react-native-maps падает в insertReactSubview.
            // Кадрируем отдельно, императивно (см. эффект ниже). Заодно карта
            // перестала «отпрыгивать» назад при ручном перетаскивании.
            initialRegion={initialRegionRef.current}
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
            {markerEvents.map((event) => (
              <EventMarker
                key={event.id}
                eventId={event.id}
                latitude={event.coordinates!.latitude}
                longitude={event.coordinates!.longitude}
                photoUrl={eventPhotosMap[event.id]}
                isPast={isEventPast(event)}
                visible={visibleEventIds.has(event.id)}
                onPress={handleMarkerPress}
              />
            ))}
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
                  source={{ uri: sizedImage(eventPhotosMap[selectedEvent.id], 200) }}
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
                    {selectedEvent.displayDate || new Date(selectedEvent.startTime).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
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
  filtersButtonOverlay: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    elevation: 10, // Для Android
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 44,
    paddingHorizontal: 12,
    height: 38,
    // Тот же фон и скругление, что у «назад» и заголовка, — три оверлея
    // читаются как одна панель управления картой.
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  filtersButtonActive: {
    backgroundColor: '#FF8D32',
  },
  filtersButtonCount: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyFilterNotice: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 998,
    elevation: 8, // Для Android
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  emptyFilterText: {
    flex: 1,
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyFilterButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FF8D32',
  },
  emptyFilterButtonText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
  },
  filtersPanelOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    elevation: 9, // Для Android
    // Панель не должна закрывать карту целиком — ограничиваем высоту,
    // содержимое при необходимости прокручивается.
    maxHeight: '70%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
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
